const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { ALLOWED_DURATION_CODES, REDEEM_DURATION_VALUES } = require('./redeem-config');
const { registerAuthRoutes } = require('./routes/auth');
const { createRedeemHelpers, registerRedeemRoutes } = require('./routes/redeem');
const { registerWalletRoutes } = require('./routes/wallet');
const {
  User,
  Share,
  VerificationCode,
  PaymentRecord,
  RedeemCode,
  RedeemRecord,
  WithdrawalAccount,
  Withdrawal,
  MessageThread,
  MessageEntry,
  initDB
} = require('./db');

const initialEnvKeys = new Set(Object.keys(process.env));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const envLines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  envLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!key) return;
    if (initialEnvKeys.has(key)) return;
    process.env[key] = value;
  });
}

const runtimeMode = String(process.env.NODE_ENV || 'development').trim() || 'development';
[
  '.env',
  '.env.local',
  `.env.${runtimeMode}`,
  `.env.${runtimeMode}.local`
].forEach((fileName) => {
  loadEnvFile(path.join(__dirname, fileName));
});

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : TURNSTILE_TEST_SECRET_KEY);
const SEND_CODE_COOLDOWN_MS = 60 * 1000;
const REDEEM_CAPTCHA_WINDOW_MS = 10 * 60 * 1000;
const REDEEM_CAPTCHA_BURST_WINDOW_MS = 2 * 60 * 1000;
const REDEEM_CAPTCHA_FAIL_THRESHOLD = 2;
const REDEEM_CAPTCHA_BURST_THRESHOLD = 5;
const SUPPORT_THREAD_IDLE_MS = 10 * 60 * 1000;
const MOCK_PAYMENT_LEGACY_TYPE = 'mock-payment';
const sendCodeCooldownMap = new Map();
const redeemCaptchaGuardMap = new Map();

function assertRuntimeConfig() {
  if (!JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }
}

assertRuntimeConfig();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const decodedName = decodeOriginalName(file.originalname);
    const ext = path.extname(decodedName || file.originalname || '').toLowerCase();
    const safeExt = ext && /^[.\w-]{1,16}$/.test(ext) ? ext : '';
    cb(null, `${crypto.randomBytes(24).toString('hex')}${safeExt}`);
  }
});

const upload = multer({ storage: storage });
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

// Helper functions
function generateCode(length = 6) {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateShareCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRedeemCodeValue(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateUniqueShareCode(length = 8) {
  // ?????????????
  for (let i = 0; i < 5; i++) {
    const code = generateShareCode(length);
    const exists = await Share.findOne({ where: { shareCode: code } });
    if (!exists) return code;
  }
  // ??????????????????????
  return generateShareCode(length);
}

async function generateUniqueRedeemCodes(count, length = 10) {
  const codes = new Set();
  let rounds = 0;

  while (codes.size < count && rounds < 20) {
    rounds += 1;
    const need = count - codes.size;
    const candidates = Array.from({ length: Math.max(need * 3, 12) }, () => generateRedeemCodeValue(length))
      .filter((code, index, array) => array.indexOf(code) === index)
      .filter((code) => !codes.has(code));

    if (!candidates.length) {
      continue;
    }

    const exists = await RedeemCode.findAll({
      where: { code: { [Op.in]: candidates } },
      attributes: ['code']
    });
    const existedSet = new Set(exists.map((item) => item.code));

    candidates.forEach((code) => {
      if (!existedSet.has(code) && codes.size < count) {
        codes.add(code);
      }
    });
  }

  if (codes.size < count) {
    throw new Error('生成卡密失败，请重试');
  }

  return Array.from(codes);
}

function mapResourceType(resourceType) {
  switch (resourceType) {
    case 'cloud':
      return '网盘';
    case 'url':
      return '链接';
    case 'text':
      return '文本信息';
    case 'file':
    default:
      return '文件';
  }
}

function ensureFileNameWithExt(name, originalName) {
  const ext = path.extname(originalName || '');
  if (!name) return originalName || '';
  if (!ext) return name;
  return name.toLowerCase().endsWith(ext.toLowerCase()) ? name : `${name}${ext}`;
}

function decodeOriginalName(name) {
  try {
    return Buffer.from(name || '', 'binary').toString('utf8');
  } catch (e) {
    return name || '';
  }
}

function repairStoredName(name) {
  const value = String(name || '');
  if (!value) return '';
  if (!/[ÃÂÅÆÐÑØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö]/.test(value)) {
    return value;
  }
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return repaired && !repaired.includes('\uFFFD') ? repaired : value;
  } catch {
    return value;
  }
}

function resolveDownloadExt(share) {
  const currentExt = path.extname(String(share?.fileName || ''));
  if (currentExt) {
    return currentExt;
  }
  const originalExt = path.extname(repairStoredName(share?.originalName || ''));
  if (originalExt) {
    return originalExt;
  }
  const filePathExt = path.extname(String(share?.filePath || ''));
  if (filePathExt) {
    return filePathExt;
  }
  return '.dat';
}

function buildOpaqueDownloadName(share) {
  const ext = resolveDownloadExt(share).toLowerCase();
  const opaqueName = crypto.randomBytes(8).toString('hex');
  return `${opaqueName}${ext}`;
}

function resolveStoredFilePath(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.join(__dirname, filePath);
}

function removeStoredFile(filePath, context = 'File') {
  const storedFilePath = resolveStoredFilePath(filePath);
  if (!storedFilePath || !fs.existsSync(storedFilePath)) {
    return;
  }

  fs.unlink(storedFilePath, (err) => {
    if (err) {
      console.warn(`[${context}] Failed to remove file:`, err.message);
    }
  });
}

function generateWithdrawalNo() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `WD${timestamp}${random}`;
}

function maskAccount(accountNo = '') {
  const value = String(accountNo);
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 3)}***@${domain || ''}`;
  }
  if (value.length <= 4) return value;
  return `**** **** **** ${value.slice(-4)}`;
}

function accountDisplayName(account) {
  if (!account) return '';
  const prefix = account.type === 'bank' ? (account.bankName || '银行卡') : '支付宝';
  return `${prefix} (${maskAccount(account.accountNo)})`;
}

function mapWithdrawalStatus(status) {
  return ({ pending: '审核中', approved: '审核通过', paid: '已到账', rejected: '已驳回' })[status] || status || '审核中';
}

function toNumber(value) {
  return Number.parseFloat(value || 0) || 0;
}

function normalizeContact(value) {
  return String(value || '').trim();
}

function assertContact(contact) {
  if (!contact) return '联系方式不能为空';
  if (contact.length > 64) return '联系方式长度不能超过 64 个字符';
  return '';
}

function formatDateYmd(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parsePaginationParams(query, defaultLimit = 10, maxLimit = 50) {
  const pageValue = Number.parseInt(String(query?.page || ''), 10);
  const limitValue = Number.parseInt(String(query?.limit || ''), 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? Math.min(limitValue, maxLimit)
    : defaultLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function buildPaginatedResult(items, page, limit) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const total = normalizedItems.length;
  const offset = (page - 1) * limit;

  return {
    data: normalizedItems.slice(offset, offset + limit),
    total,
    page,
    limit
  };
}

async function resolveAuthUser(req) {
  if (!req.user?.phone) return null;
  return User.findOne({ where: { phone: req.user.phone } });
}

async function requireAuthUser(req, res) {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '用户不存在或登录已失效，请重新登录' });
    return null;
  }
  return authUser;
}

async function resolveOptionalAuthUser(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return User.findOne({ where: { phone: payload.phone } });
  } catch {
    return null;
  }
}

function signUserToken(user) {
  return jwt.sign({ phone: user.phone, role: user.role || 'user' }, JWT_SECRET);
}

function verifyJwtToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

const {
  normalizeRedeemRecordStatus,
  signRedeemAccessToken,
  resolveRedeemAccessToken,
  findActiveRedeemRecord,
} = createRedeemHelpers({
  jwt,
  JWT_SECRET,
  RedeemRecord,
  Op,
  verifyJwtToken,
});

function hashPasswordLegacy(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function isLegacyPasswordHash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const normalizedHash = String(storedHash || '').trim();
  if (!normalizedHash) return false;

  if (isLegacyPasswordHash(normalizedHash)) {
    const expected = Buffer.from(hashPasswordLegacy(password), 'hex');
    const actual = Buffer.from(normalizedHash, 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  const [algorithm, salt, derivedKey] = normalizedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !derivedKey || derivedKey.length % 2 !== 0) {
    return false;
  }

  const actual = Buffer.from(derivedKey, 'hex');
  const expected = crypto.scryptSync(String(password || ''), salt, actual.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function needsPasswordRehash(storedHash) {
  const normalizedHash = String(storedHash || '').trim();
  return !normalizedHash || isLegacyPasswordHash(normalizedHash) || !normalizedHash.startsWith('scrypt$');
}

async function upgradePasswordHashIfNeeded(user, password) {
  if (!user?.password || !needsPasswordRehash(user.password)) {
    return false;
  }

  user.password = hashPassword(password);
  await user.save();
  return true;
}

function resolveAccountValue(payload) {
  return String(payload?.account || payload?.email || payload?.phone || '').trim();
}

function isEmailAccount(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isPhoneAccount(value) {
  return /^1[3-9]\d{9}$/.test(String(value || '').trim());
}

function isValidAccount(value) {
  return isEmailAccount(value) || isPhoneAccount(value);
}

function getClientIp(req) {
  const forwarded = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

function getRedeemCaptchaGuardKey(req) {
  return getClientIp(req) || 'unknown';
}

function readRedeemCaptchaGuard(req) {
  const key = getRedeemCaptchaGuardKey(req);
  const now = Date.now();
  const raw = redeemCaptchaGuardMap.get(key) || { attempts: [], failures: [] };
  const attempts = Array.isArray(raw.attempts)
    ? raw.attempts.filter((time) => now - Number(time) <= REDEEM_CAPTCHA_WINDOW_MS)
    : [];
  const failures = Array.isArray(raw.failures)
    ? raw.failures.filter((time) => now - Number(time) <= REDEEM_CAPTCHA_WINDOW_MS)
    : [];

  if (attempts.length || failures.length) {
    redeemCaptchaGuardMap.set(key, { attempts, failures });
  } else {
    redeemCaptchaGuardMap.delete(key);
  }

  return { key, attempts, failures, now };
}

function shouldRequireRedeemCaptcha(req) {
  const { attempts, failures, now } = readRedeemCaptchaGuard(req);
  if (failures.length >= REDEEM_CAPTCHA_FAIL_THRESHOLD) return true;
  const burstAttempts = attempts.filter((time) => now - Number(time) <= REDEEM_CAPTCHA_BURST_WINDOW_MS);
  return burstAttempts.length >= REDEEM_CAPTCHA_BURST_THRESHOLD;
}

function recordRedeemCaptchaAttempt(req, success = false) {
  const { key, attempts, failures, now } = readRedeemCaptchaGuard(req);
  attempts.push(now);
  const nextFailures = success ? [] : [...failures, now];
  redeemCaptchaGuardMap.set(key, {
    attempts: attempts.filter((time) => now - Number(time) <= REDEEM_CAPTCHA_WINDOW_MS),
    failures: nextFailures.filter((time) => now - Number(time) <= REDEEM_CAPTCHA_WINDOW_MS)
  });
}

function getSendCodeCooldownKey(account, req) {
  return `${String(account || '').trim().toLowerCase()}::${getClientIp(req)}`;
}

function getSendCodeCooldownRemaining(account, req) {
  const key = getSendCodeCooldownKey(account, req);
  const expiresAt = Number(sendCodeCooldownMap.get(key) || 0);
  const now = Date.now();

  if (!expiresAt || expiresAt <= now) {
    sendCodeCooldownMap.delete(key);
    return 0;
  }

  return expiresAt - now;
}

function setSendCodeCooldown(account, req) {
  const key = getSendCodeCooldownKey(account, req);
  sendCodeCooldownMap.set(key, Date.now() + SEND_CODE_COOLDOWN_MS);
}

async function verifyTurnstileToken(captchaToken, req) {
  const normalizedToken = String(captchaToken || '').trim();

  if (!TURNSTILE_SECRET_KEY) {
    return { success: false, misconfigured: true, error: 'Turnstile secret key 未配置' };
  }

  if (!normalizedToken) {
    return { success: false, error: '请先完成人机验证' };
  }

  const formData = new URLSearchParams();
  formData.set('secret', TURNSTILE_SECRET_KEY);
  formData.set('response', normalizedToken);

  const remoteIp = getClientIp(req);
  if (remoteIp) {
    formData.set('remoteip', remoteIp);
  }
  if (crypto.randomUUID) {
    formData.set('idempotency_key', crypto.randomUUID());
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      console.warn('[Turnstile] verify failed:', {
        errors: data['error-codes'],
        action: data.action,
        hostname: data.hostname,
        ip: remoteIp,
      });
      return { success: false, error: '人机验证未通过，请重试' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Turnstile] verify error:', error);
    return { success: false, error: '人机验证服务暂不可用，请稍后重试' };
  }
}

async function ensureTurnstile(req, res, scene = '当前操作') {
  const result = await verifyTurnstileToken(
    req.body?.captchaToken || req.body?.turnstileToken || req.body?.['cf-turnstile-response'],
    req
  );

  if (result.success) {
    return true;
  }

  if (result.misconfigured) {
    res.status(503).json({ error: `${scene}失败：服务器未配置 Turnstile` });
    return false;
  }

  res.status(400).json({ error: result.error || `${scene}未通过人机验证` });
  return false;
}

function buildDefaultNickname(account) {
  const normalized = String(account || '').trim();
  if (!normalized) return 'User';

  if (isEmailAccount(normalized)) {
    const prefix = normalized
      .split('@')[0]
      .replace(/[^\w\u4e00-\u9fa5-]/g, '')
      .slice(0, 16);
    return prefix || 'User';
  }

  return `User${normalized.slice(-4) || '0000'}`;
}

function formatThreadTime(value) {
  if (!value) return '';
  return new Date(value).toISOString();
}

function formatMessageEntry(entry) {
  return {
    id: entry.id,
    role: entry.senderRole,
    text: entry.content,
    type: entry.messageType,
    isRead: Boolean(entry.isRead),
    time: formatThreadTime(entry.createdAt),
    createdAt: entry.createdAt
  };
}

function getThreadLastActivityTime(thread) {
  const value = thread?.lastMessageAt || thread?.updatedAt || thread?.createdAt;
  const timestamp = new Date(value || Date.now()).getTime();
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function getThreadUserNickname(thread) {
  return thread?.User?.nickname || buildDefaultNickname(thread?.userPhone || '');
}

function isSupportThreadExpired(thread, now = Date.now()) {
  if (!thread || thread.type !== 'support') return false;
  if (thread.status === 'expired') return true;
  if (thread.status === 'closed') return false;
  return now - getThreadLastActivityTime(thread) > SUPPORT_THREAD_IDLE_MS;
}

function getThreadEffectiveStatus(thread) {
  if (isSupportThreadExpired(thread) && thread.status !== 'closed') {
    return 'expired';
  }
  return thread.status;
}

function canReplyToThread(thread, viewerRole) {
  const status = getThreadEffectiveStatus(thread);
  if (thread.type === 'system') return false;
  if (status === 'closed' || status === 'expired') return false;
  if (viewerRole === 'admin') {
    return thread.type === 'support' || thread.type === 'guestbook';
  }
  return thread.type === 'support' || thread.type === 'guestbook';
}

function formatThread(thread, viewerRole = 'user') {
  const status = getThreadEffectiveStatus(thread);
  const canReply = canReplyToThread(thread, viewerRole);
  const sessionExpiresAt = thread.type === 'support'
    ? new Date(getThreadLastActivityTime(thread) + SUPPORT_THREAD_IDLE_MS).toISOString()
    : null;

  return {
    id: thread.id,
    type: thread.type,
    title: thread.title,
    preview: thread.description || '',
    status,
    priority: thread.priority,
    unreadCount: thread.unreadCount || 0,
    lastMessageAt: formatThreadTime(thread.lastMessageAt || thread.updatedAt),
    createdAt: thread.createdAt,
    userPhone: viewerRole === 'admin' ? thread.userPhone : undefined,
    userNickname: viewerRole === 'admin' ? getThreadUserNickname(thread) : undefined,
    canReply,
    readOnly: !canReply,
    needsReply: viewerRole === 'admin'
      ? (thread.type === 'support' || thread.type === 'guestbook') && status === 'waiting_admin'
      : false,
    sessionExpired: thread.type === 'support' ? status === 'expired' : false,
    sessionExpiresAt
  };
}

async function appendThreadMessage(thread, payload) {
  const entry = await MessageEntry.create({
    threadId: thread.id,
    senderRole: payload.senderRole,
    content: payload.content,
    messageType: payload.messageType || 'chat',
    isRead: Boolean(payload.isRead)
  });

  thread.description = payload.content.slice(0, 80);
  thread.lastMessageAt = entry.createdAt;
  if (!payload.isRead && payload.senderRole !== 'user') {
    thread.unreadCount = (thread.unreadCount || 0) + 1;
  }
  await thread.save();
  return entry;
}

async function expireSupportThreads(userPhone) {
  const where = {
    type: 'support',
    status: {
      [Op.notIn]: ['expired', 'closed']
    }
  };

  if (userPhone) {
    where.userPhone = userPhone;
  }

  const threads = await MessageThread.findAll({ where });
  if (!threads.length) return;

  const now = Date.now();
  for (const thread of threads) {
    if (!isSupportThreadExpired(thread, now)) continue;
    thread.status = 'expired';
    await thread.save();
  }
}

async function ensureSystemThread(userPhone) {
  const existed = await MessageThread.findOne({
    where: { userPhone, type: 'system' }
  });
  if (existed) return existed;

  const thread = await MessageThread.create({
    userPhone,
    type: 'system',
    title: '系统通知',
    description: '平台消息、支付结果和安全提醒会汇总在这里。',
    status: 'open',
    priority: 'normal',
    unreadCount: 1,
    lastMessageAt: new Date()
  });

  await MessageEntry.create({
    threadId: thread.id,
    senderRole: 'system',
    content: '消息中心已启用。后续支付结果、资源审核与风控提醒会在此通知。',
    messageType: 'notification',
    isRead: false
  });

  return thread;
}

async function ensureGuestbookThread(userPhone) {
  const existed = await MessageThread.findOne({
    where: { userPhone, type: 'guestbook' }
  });
  if (existed) return existed;

  const thread = await MessageThread.create({
    userPhone,
    type: 'guestbook',
    title: '留言板',
    description: '支持需求、回访问卷和补充备注会集中保留。',
    status: 'waiting_user',
    priority: 'normal',
    unreadCount: 0,
    lastMessageAt: new Date()
  });

  await MessageEntry.create({
    threadId: thread.id,
    senderRole: 'system',
    content: '这里适合记录非即时沟通内容，例如需求留言、排期备注和补充材料。',
    messageType: 'note',
    isRead: true
  });

  return thread;
}

async function ensureMessageInbox(userPhone) {
  await ensureSystemThread(userPhone);
  await ensureGuestbookThread(userPhone);
}

async function ensureSupportSession(userPhone) {
  await expireSupportThreads(userPhone);

  const latestThread = await MessageThread.findOne({
    where: { userPhone, type: 'support' },
    order: [['lastMessageAt', 'DESC'], ['createdAt', 'DESC']]
  });

  if (latestThread && !['closed', 'expired'].includes(latestThread.status) && !isSupportThreadExpired(latestThread)) {
    return latestThread;
  }

  const thread = await MessageThread.create({
    userPhone,
    type: 'support',
    title: '对话工单',
    description: '会话已创建，请发送问题描述、资源名称或补充说明。',
    status: 'waiting_user',
    priority: 'high',
    unreadCount: 0,
    lastMessageAt: new Date()
  });

  await MessageEntry.create({
    threadId: thread.id,
    senderRole: 'system',
    content: '会话已创建，请发送问题描述、资源名称或补充说明。',
    messageType: 'notification',
    isRead: true
  });

  return thread;
}

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未登录或登录已失效，请重新登录' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: '登录已失效，请重新登录' });
    }
    req.user = user;
    next();
  });
};

// ==================== Authentication Routes ====================
registerAuthRoutes({
  app,
  authenticateToken,
  User,
  VerificationCode,
  Op,
  resolveAccountValue,
  isValidAccount,
  ensureTurnstile,
  getSendCodeCooldownRemaining,
  generateCode,
  setSendCodeCooldown,
  hashPassword,
  buildDefaultNickname,
  signUserToken,
  verifyPassword,
  upgradePasswordHashIfNeeded,
  normalizeContact,
  assertContact,
});

registerRedeemRoutes({
  app,
  authenticateToken,
  importUpload,
  User,
  Share,
  RedeemCode,
  RedeemRecord,
  Op,
  ALLOWED_DURATION_CODES,
  REDEEM_DURATION_VALUES,
  generateUniqueRedeemCodes,
  parsePaginationParams,
  requireAuthUser,
  resolveOptionalAuthUser,
  verifyTurnstileToken,
  shouldRequireRedeemCaptcha,
  recordRedeemCaptchaAttempt,
  signRedeemAccessToken,
});

// ==================== Upload & Share Routes ====================

// Upload file and create share
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { fileName, price, note, resourceType, cloudUrl, extractionCode, url, autoRedirect, content } = req.body;
    const shareCode = await generateUniqueShareCode(8);
    const normalizedFileName = String(fileName || '').trim();

    if (!normalizedFileName) {
      return res.status(400).json({ error: '资源名称不能为空' });
    }

    console.log('[Upload] Received upload request:', {
      resourceType,
      fileName: normalizedFileName,
      price,
      userPhone: req.user.phone,
      hasFile: !!req.file
    });

    let shareData = {
      shareCode,
      fileName: normalizedFileName,
      price: parseFloat(price) || 0.99,
      userPhone: req.user.phone,
      resourceType: resourceType || 'file',
      note: note || '',
      fileType: mapResourceType(resourceType || 'file')
    };

    switch (resourceType) {
      case 'file':
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        const decodedName = decodeOriginalName(req.file.originalname);
        shareData.filePath = req.file.path;
        shareData.fileSize = req.file.size;
        shareData.originalName = decodedName;
        shareData.fileType = mapResourceType('file');
        console.log('[Upload] File details:', {
          storagePath: req.file.path,
          size: req.file.size
        });
        break;

      case 'cloud':
        if (!cloudUrl) {
          return res.status(400).json({ error: 'Cloud URL is required' });
        }
        shareData.cloudUrl = cloudUrl;
        shareData.extractionCode = extractionCode || '';
        break;

      case 'url':
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }
        shareData.url = url;
        shareData.autoRedirect = autoRedirect === 'true' || autoRedirect === true;
        break;

      case 'text':
        if (!content) {
          return res.status(400).json({ error: 'Text content is required' });
        }
        shareData.content = content;
        break;

      default:
        return res.status(400).json({ error: 'Invalid resource type' });
    }

    await Share.create(shareData);
    console.log('[Upload] Resource created successfully with shareCode:', shareCode);

    res.json({
      success: true,
      shareCode,
      message: 'Resource uploaded successfully'
    });
  } catch (error) {
    console.error('[Upload] Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Get share details by code
app.get('/api/share/:code', async (req, res) => {
  try {
    const { code } = req.params;
    console.log('[Search] Looking for shareCode:', code);
    
    const share = await Share.findOne({ where: { shareCode: code } });

    if (!share) {
      console.log('[Search] Share not found for code:', code);
      return res.status(404).json({ error: 'Share not found' });
    }

    const authUser = await resolveOptionalAuthUser(req);
    const userPhone = authUser?.phone || null;

    console.log('[Search] Share found:', {
      shareCode: share.shareCode,
      fileName: share.fileName,
      resourceType: share.resourceType,
      originalName: share.originalName
    });

    let accessExpireAt = null;
    let authorizationStatus = share.price <= 0 ? 'free' : 'locked';
    let isAuthorized = share.price <= 0 || (userPhone && userPhone === share.userPhone);

    if (userPhone && userPhone === share.userPhone) {
      authorizationStatus = 'owner';
    }

    if (!isAuthorized) {
      const tokenPayload = resolveRedeemAccessToken(req, share.id);
      if (tokenPayload) {
        isAuthorized = true;
        authorizationStatus = 'granted';
        if (tokenPayload.exp) {
          accessExpireAt = new Date(tokenPayload.exp * 1000);
        }
      }
    }

    if (!isAuthorized) {
      const record = await findActiveRedeemRecord({ shareId: share.id, authUser });
      if (record) {
        isAuthorized = true;
        accessExpireAt = record.accessExpireAt;
        authorizationStatus = 'granted';
      }
    }

    const shareInfo = share.toJSON();
    delete shareInfo.filePath;
    delete shareInfo.originalName;
    if (share.resourceType === 'file') {
      shareInfo.downloadFileName = buildOpaqueDownloadName(share);
    }
    if (isAuthorized && share.resourceType === 'file' && share.originalName) {
      shareInfo.uploadedFileName = repairStoredName(share.originalName);
    }

    // For safety, hide URL-like content unless authorized/owner/free
    if (!isAuthorized) {
      delete shareInfo.cloudUrl;
      delete shareInfo.extractionCode;
      delete shareInfo.url;
      delete shareInfo.content;
      delete shareInfo.autoRedirect;
      delete shareInfo.note;
    }

    shareInfo.isPaid = isAuthorized;
    shareInfo.accessExpireAt = accessExpireAt;
    shareInfo.authorizationStatus = authorizationStatus;
    res.json({
      success: true,
      data: shareInfo
    });
  } catch (error) {
    console.error('[Search] Get share error:', error);
    res.status(500).json({ error: 'Failed to get share details' });
  }
});

// Get user's shares with pagination
app.get('/api/dashboard-summary', authenticateToken, async (req, res) => {
  try {
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const shareWhere = authUser.role === 'admin' ? {} : { userPhone: authUser.phone };
    const ownerWhere = authUser.role === 'admin' ? {} : { ownerUserId: authUser.id };
    const now = new Date();
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - 6);

    const [
      shareRows,
      unusedCodeCount,
      usedCodeCount,
      disabledCodeCount,
      totalRedeemCount,
      activeAuthorizationCount,
      expiredAuthorizationCount,
      trendRows,
      recentRows
    ] = await Promise.all([
      Share.findAll({
        where: shareWhere,
        attributes: ['resourceType']
      }),
      RedeemCode.count({ where: { ...ownerWhere, status: 'unused' } }),
      RedeemCode.count({ where: { ...ownerWhere, status: 'used' } }),
      RedeemCode.count({ where: { ...ownerWhere, status: 'disabled' } }),
      RedeemRecord.count({ where: ownerWhere }),
      RedeemRecord.count({
        where: {
          ...ownerWhere,
          status: 'active',
          accessExpireAt: { [Op.gt]: now }
        }
      }),
      RedeemRecord.count({
        where: {
          ...ownerWhere,
          [Op.or]: [
            { status: 'expired' },
            {
              status: 'active',
              accessExpireAt: { [Op.lte]: now }
            }
          ]
        }
      }),
      RedeemRecord.findAll({
        where: {
          ...ownerWhere,
          redeemedAt: { [Op.gte]: rangeStart }
        },
        attributes: ['redeemedAt']
      }),
      RedeemRecord.findAll({
        where: ownerWhere,
        include: [
          { model: Share, attributes: ['fileName', 'resourceType', 'shareCode'] },
          { model: RedeemCode, as: 'code', attributes: ['code'] }
        ],
        order: [['redeemedAt', 'DESC']],
        limit: 20
      })
    ]);

    const resourceDistributionMap = new Map();
    shareRows.forEach((item) => {
      const key = item.resourceType || 'file';
      resourceDistributionMap.set(key, (resourceDistributionMap.get(key) || 0) + 1);
    });

    const trendMap = new Map();
    trendRows.forEach((item) => {
      const key = formatDateYmd(item.redeemedAt);
      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    });

    const trend = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(rangeStart);
      current.setDate(rangeStart.getDate() + index);
      const dateKey = formatDateYmd(current);
      return {
        date: dateKey,
        count: trendMap.get(dateKey) || 0
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          resourceCount: shareRows.length,
          unusedCodeCount,
          usedCodeCount,
          disabledCodeCount,
          totalRedeemCount,
          activeAuthorizationCount,
          expiredAuthorizationCount
        },
        distribution: Array.from(resourceDistributionMap.entries()).map(([resourceType, count]) => ({
          resourceType,
          count
        })),
        trend,
        recentRecords: recentRows.map((row) => ({
          id: row.id,
          shareCode: row.Share ? row.Share.shareCode : '',
          resourceName: row.Share ? row.Share.fileName : '',
          resourceType: row.Share ? row.Share.resourceType : '',
          code: row.code ? row.code.code : '',
          redeemedAt: row.redeemedAt,
          accessExpireAt: row.accessExpireAt,
          status: normalizeRedeemRecordStatus(row)
        }))
      }
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ error: '获取仪表盘数据失败' });
  }
});

app.get('/api/my-shares', authenticateToken, async (req, res) => {
  try {
    const authUser = await requireAuthUser(req, res);
    if (!authUser) return;

    const { page, limit, offset } = parsePaginationParams(req.query, 10, 200);
    const keyword = String(req.query.keyword || '').trim();
    const startDate = String(req.query.startDate || '').trim();
    const endDate = String(req.query.endDate || '').trim();
    const where = authUser.role === 'admin' ? {} : { userPhone: authUser.phone };

    if (keyword) {
      const keywordConditions = [
        { fileName: { [Op.like]: `%${keyword}%` } },
        { shareCode: { [Op.like]: `%${keyword}%` } }
      ];
      if (/^\d+$/.test(keyword)) {
        keywordConditions.push({ id: Number(keyword) });
      }
      where[Op.or] = keywordConditions;
    }

    if (startDate || endDate) {
      where.createdAt = {};

      if (startDate) {
        const parsedStart = new Date(startDate);
        if (!Number.isNaN(parsedStart.getTime())) {
          parsedStart.setHours(0, 0, 0, 0);
          where.createdAt[Op.gte] = parsedStart;
        }
      }

      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (!Number.isNaN(parsedEnd.getTime())) {
          parsedEnd.setHours(23, 59, 59, 999);
          where.createdAt[Op.lte] = parsedEnd;
        }
      }

      if (!Object.keys(where.createdAt).length) {
        delete where.createdAt;
      }
    }

    const { count, rows } = await Share.findAndCountAll({ 
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const userShares = rows.map(share => {
      const shareInfo = share.toJSON();
      delete shareInfo.filePath;
      delete shareInfo.originalName;
      return shareInfo;
    });

    res.json({
      success: true,
      data: userShares,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Get user shares error:', error);
    res.status(500).json({ error: 'Failed to get user shares' });
  }
});

// Get earnings for current user (seller)
app.get('/api/earnings', authenticateToken, async (req, res) => {
  return res.status(410).json({
    error: '旧收益接口已停用，请使用兑换记录统计',
    code: 'LEGACY_EARNINGS_DISABLED'
  });
});

// Delete share
app.delete('/api/share/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;
    const share = await Share.findOne({ where: { shareCode: code, userPhone: req.user.phone } });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    removeStoredFile(share.filePath, 'DeleteShare');

    await share.destroy();
    res.json({ success: true, message: 'Share deleted' });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: 'Failed to delete share' });
  }
});

// Update share info (including optional file replacement)
app.put('/api/share/:code', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { code } = req.params;
    const share = await Share.findOne({ where: { shareCode: code, userPhone: req.user.phone } });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const { fileName, price, note, resourceType, cloudUrl, extractionCode, url, autoRedirect, content, fileType } = req.body;
    const normalizedFileName = fileName !== undefined ? String(fileName).trim() : undefined;

    if (normalizedFileName !== undefined) {
      if (!normalizedFileName) {
        return res.status(400).json({ error: '资源名称不能为空' });
      }
      share.fileName = normalizedFileName;
    }
    if (price !== undefined) share.price = parseFloat(price);
    if (note !== undefined) share.note = note;

    if (req.file) {
      removeStoredFile(share.filePath, 'UpdateShare');
      share.resourceType = 'file';
      share.filePath = req.file.path;
      share.fileSize = req.file.size;
      const decodedName = decodeOriginalName(req.file.originalname);
      share.originalName = decodedName;
      share.fileType = mapResourceType('file');
    } else if (resourceType) {
      share.resourceType = resourceType;
      switch (resourceType) {
        case 'cloud':
          removeStoredFile(share.filePath, 'UpdateShare');
          share.cloudUrl = cloudUrl;
          share.extractionCode = extractionCode || '';
          share.filePath = null;
          share.originalName = null;
          share.fileSize = null;
          share.fileType = mapResourceType(resourceType);
          break;
        case 'url':
          removeStoredFile(share.filePath, 'UpdateShare');
          share.url = url;
          share.autoRedirect = autoRedirect === 'true' || autoRedirect === true;
          share.filePath = null;
          share.originalName = null;
          share.fileSize = null;
          share.fileType = mapResourceType(resourceType);
          break;
        case 'text':
          removeStoredFile(share.filePath, 'UpdateShare');
          share.content = content;
          share.filePath = null;
          share.originalName = null;
          share.fileSize = null;
          share.fileType = mapResourceType(resourceType);
          break;
      }
    } else if (fileType) {
      share.fileType = fileType;
    }

    await share.save();
    const shareInfo = share.toJSON();
    delete shareInfo.filePath;
    delete shareInfo.originalName;
    if (share.resourceType === 'file' && share.originalName) {
      shareInfo.uploadedFileName = repairStoredName(share.originalName);
    }

    res.json({ success: true, data: shareInfo });
  } catch (error) {
    console.error('Update share error:', error);
    res.status(500).json({ error: 'Failed to update share' });
  }
});

// Legacy payment route has been retired in favor of redeem codes
app.post('/api/payment', async (req, res) => {
  return res.status(410).json({
    error: '旧支付链路已停用，请改用卡密兑换访问资源',
    code: 'LEGACY_PAYMENT_DISABLED'
  });
});

// Check payment status
app.get('/api/check-payment/:code', async (req, res) => {
  return res.status(410).json({
    error: '旧支付状态接口已停用，请使用卡密兑换状态',
    code: 'LEGACY_PAYMENT_DISABLED'
  });
});

// Recover order by ID
app.post('/api/recover-by-order', async (req, res) => {
  return res.status(410).json({
    error: '订单号找回接口已停用，请使用卡密查询资源',
    code: 'LEGACY_ORDER_RECOVERY_DISABLED'
  });
});

// Link order to user
app.post('/api/link-order', authenticateToken, async (req, res) => {
  return res.status(410).json({
    error: '订单关联接口已停用，请使用卡密兑换授权',
    code: 'LEGACY_ORDER_LINK_DISABLED'
  });
});

// ==================== Wallet & Withdrawal Routes ====================
registerWalletRoutes({
  app,
  authenticateToken,
  PaymentRecord,
  Share,
  WithdrawalAccount,
  Withdrawal,
  parsePaginationParams,
  buildPaginatedResult,
  requireAuthUser,
  toNumber,
  mapWithdrawalStatus,
  accountDisplayName,
  maskAccount,
  generateWithdrawalNo,
  Op,
  mockPaymentLegacyType: MOCK_PAYMENT_LEGACY_TYPE,
});

// ==================== Message Center Routes ====================

app.get('/api/messages/unread-summary', authenticateToken, async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: '用户不存在或登录已失效' });
    }

    if (authUser.role === 'admin') {
      await expireSupportThreads();
      const pendingCount = await MessageThread.count({
        where: {
          type: { [Op.in]: ['support', 'guestbook'] },
          status: 'waiting_admin'
        }
      });
      return res.json({ success: true, data: { unreadCount: pendingCount, pendingCount } });
    }

    await ensureMessageInbox(authUser.phone);
    await expireSupportThreads(authUser.phone);
    const threads = await MessageThread.findAll({ where: { userPhone: authUser.phone } });
    const unreadCount = threads.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
    const pendingCount = threads.filter((item) => item.status === 'waiting_admin').length;
    res.json({ success: true, data: { unreadCount, pendingCount } });
  } catch (error) {
    console.error('Get message summary error:', error);
    res.status(500).json({ error: '获取消息汇总失败' });
  }
});

app.get('/api/messages/threads', authenticateToken, async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: '用户不存在或登录已失效' });
    }

    if (authUser.role === 'admin') {
      await expireSupportThreads();
    } else {
      await ensureMessageInbox(authUser.phone);
      await expireSupportThreads(authUser.phone);
    }

    const type = req.query.type ? String(req.query.type) : '';
    const where = {
      ...(authUser.role === 'admin' ? {} : { userPhone: authUser.phone }),
      ...(type && type !== 'all' ? { type } : {})
    };
    const query = {
      where,
      order: [['lastMessageAt', 'DESC'], ['updatedAt', 'DESC']]
    };

    if (authUser.role === 'admin') {
      query.include = [{ model: User, attributes: ['phone', 'nickname'], required: false }];
    }

    const threads = await MessageThread.findAll(query);

    res.json({
      success: true,
      data: threads.map((item) => formatThread(item, authUser.role))
    });
  } catch (error) {
    console.error('Get message threads error:', error);
    res.status(500).json({ error: '获取消息会话失败' });
  }
});

app.post('/api/messages/support/session', authenticateToken, async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: '用户不存在或登录已失效' });
    }

    if (authUser.role === 'admin') {
      return res.status(403).json({ error: '管理员无需创建对话工单会话' });
    }

    await ensureMessageInbox(authUser.phone);
    const thread = await ensureSupportSession(authUser.phone);

    res.json({
      success: true,
      data: formatThread(thread, authUser.role)
    });
  } catch (error) {
    console.error('Ensure support session error:', error);
    res.status(500).json({ error: '创建对话工单会话失败' });
  }
});

app.get('/api/messages/threads/:id', authenticateToken, async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: '用户不存在或登录已失效' });
    }

    if (authUser.role !== 'admin') {
      await ensureMessageInbox(authUser.phone);
    }

    const thread = await MessageThread.findOne({
      where: authUser.role === 'admin'
        ? { id: req.params.id }
        : { id: req.params.id, userPhone: authUser.phone },
      include: [{ model: User, attributes: ['phone', 'nickname'], required: false }]
    });

    if (!thread) {
      return res.status(404).json({ error: '消息会话不存在' });
    }

    if (isSupportThreadExpired(thread) && !['expired', 'closed'].includes(thread.status)) {
      thread.status = 'expired';
      await thread.save();
    }

    if (authUser.role !== 'admin') {
      await MessageEntry.update(
        { isRead: true },
        {
          where: {
            threadId: thread.id,
            senderRole: { [Op.ne]: 'user' },
            isRead: false
          }
        }
      );

      thread.unreadCount = 0;
      await thread.save();
    }

    const entries = await MessageEntry.findAll({
      where: { threadId: thread.id },
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        thread: formatThread(thread, authUser.role),
        messages: entries.map(formatMessageEntry)
      }
    });
  } catch (error) {
    console.error('Get message thread detail error:', error);
    res.status(500).json({ error: '获取消息详情失败' });
  }
});

app.post('/api/messages/threads/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { content, messageType } = req.body;
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: '请输入消息内容' });
    }

    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: '用户不存在或登录已失效' });
    }

    if (authUser.role !== 'admin') {
      await ensureMessageInbox(authUser.phone);
    }

    const thread = await MessageThread.findOne({
      where: authUser.role === 'admin'
        ? { id: req.params.id }
        : { id: req.params.id, userPhone: authUser.phone }
    });

    if (!thread) {
      return res.status(404).json({ error: '消息会话不存在' });
    }

    if (isSupportThreadExpired(thread) && !['expired', 'closed'].includes(thread.status)) {
      thread.status = 'expired';
      await thread.save();
    }

    if (thread.status === 'closed') {
      return res.status(409).json({ error: '当前会话已关闭' });
    }

    if (thread.type === 'system') {
      return res.status(403).json({ error: '系统通知仅支持查看，暂不支持回复' });
    }

    if (thread.type === 'support' && thread.status === 'expired') {
      return res.status(409).json({
        error: authUser.role === 'admin' ? '当前工单会话已超时，无法继续回复' : '当前工单会话已超时，请重新发起会话',
        code: 'SUPPORT_THREAD_EXPIRED'
      });
    }

    const senderRole = authUser.role === 'admin' ? 'admin' : 'user';
    const entry = await appendThreadMessage(thread, {
      senderRole,
      content: String(content).trim(),
      messageType: thread.type === 'guestbook'
        ? 'note'
        : messageType === 'note'
          ? 'note'
          : 'chat',
      isRead: senderRole === 'user'
    });

    if (thread.type === 'support' || thread.type === 'guestbook') {
      thread.status = senderRole === 'admin' ? 'waiting_user' : 'waiting_admin';
      await thread.save();
    }

    res.json({
      success: true,
      data: formatMessageEntry(entry)
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: '发送消息失败' });
  }
});

// Download share content (file or other resource)
app.get('/api/download/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const share = await Share.findOne({ where: { shareCode: code } });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const authUser = await resolveOptionalAuthUser(req);
    const userPhone = authUser?.phone || null;

    let isAuthorized = share.price <= 0 || (userPhone && userPhone === share.userPhone);

    if (!isAuthorized) {
      const tokenPayload = resolveRedeemAccessToken(req, share.id);
      if (tokenPayload) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const record = await findActiveRedeemRecord({ shareId: share.id, authUser });
      if (record) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: '授权已过期，请获取新的卡密后重新兑换。' });
    }

    if (share.resourceType === 'file') {
      const storedFilePath = resolveStoredFilePath(share.filePath);
      if (!storedFilePath || !fs.existsSync(storedFilePath)) {
        return res.status(404).json({ error: 'File not found' });
      }
      share.downloads += 1;
      await share.save();
      return res.download(storedFilePath, buildOpaqueDownloadName(share));
    }

    const shareInfo = share.toJSON();
    delete shareInfo.filePath;

    res.json({ success: true, data: shareInfo });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ==================== Server Initialization ====================

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
  });
});
