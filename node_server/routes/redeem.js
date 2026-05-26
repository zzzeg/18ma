function createRedeemHelpers({
  jwt,
  JWT_SECRET,
  verifyJwtToken,
  RedeemRecord,
  Op,
}) {
  function normalizeRedeemRecordStatus(row) {
    if (row.status === 'revoked') return 'revoked';
    if (!row.accessExpireAt) return row.status || 'expired';
    return new Date(row.accessExpireAt).getTime() > Date.now() ? 'active' : 'expired';
  }

  function signRedeemAccessToken({ shareId, codeId, accessExpireAt }) {
    const expiresAt = new Date(accessExpireAt);
    const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    return jwt.sign({ type: 'redeem-access', shareId, codeId }, JWT_SECRET, { expiresIn });
  }

  function resolveRedeemAccessToken(req, shareId) {
    const rawToken = String(req.query.accessToken || '').trim();
    if (!rawToken) return null;
    try {
      const payload = typeof verifyJwtToken === 'function'
        ? verifyJwtToken(rawToken)
        : jwt.verify(rawToken, JWT_SECRET);
      if (payload?.type !== 'redeem-access') return null;
      if (Number(payload.shareId) !== Number(shareId)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async function findActiveRedeemRecord({ shareId, authUser }) {
    const now = new Date();
    const where = {
      resourceId: shareId,
      status: 'active',
      accessExpireAt: { [Op.gt]: now }
    };

    if (!authUser?.id) return null;
    where.redeemedByUserId = authUser.id;

    return RedeemRecord.findOne({
      where,
      order: [['accessExpireAt', 'DESC']]
    });
  }

  return {
    normalizeRedeemRecordStatus,
    signRedeemAccessToken,
    resolveRedeemAccessToken,
    findActiveRedeemRecord,
  };
}

function registerRedeemRoutes({
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
}) {
  function parseDurationToMs(durationCode) {
    const unit = durationCode.slice(-1);
    const amount = Number.parseInt(durationCode.slice(0, -1), 10);
    if (!amount || !ALLOWED_DURATION_CODES.has(durationCode)) return 0;
    return unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
  }

  function generateBatchNo() {
    return `BATCH${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  function generateRedeemNo() {
    return `RDM${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  }

  function parseRedeemCodeContent(content) {
    const rows = String(content || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = [];
    const errors = [];
    const codeSet = new Set();

    rows.forEach((line, index) => {
      const parts = line.split(',');
      if (parts.length !== 2) {
        errors.push({ line: index + 1, reason: '格式错误，应为 卡密,有效时长' });
        return;
      }

      const code = parts[0].trim();
      const durationCode = parts[1].trim().toLowerCase();

      if (!code) {
        errors.push({ line: index + 1, reason: '卡密不能为空' });
        return;
      }

      if (code.length > 64) {
        errors.push({ line: index + 1, reason: '卡密长度不能超过 64 个字符' });
        return;
      }

      if (!ALLOWED_DURATION_CODES.has(durationCode)) {
        errors.push({ line: index + 1, reason: `有效时长仅支持 ${REDEEM_DURATION_VALUES.join('、')}` });
        return;
      }

      const normalizedCode = code.toUpperCase();
      if (codeSet.has(normalizedCode)) {
        errors.push({ line: index + 1, reason: '同一批次内卡密重复' });
        return;
      }

      codeSet.add(normalizedCode);
      parsed.push({ code: normalizedCode, durationCode });
    });

    return { parsed, errors };
  }

  function formatRedeemCode(row) {
    return {
      id: row.id,
      code: row.code,
      resourceId: row.resourceId,
      resourceName: row.Share ? row.Share.fileName : '',
      resourceType: row.Share ? row.Share.resourceType : '',
      shareCode: row.Share ? row.Share.shareCode : '',
      durationCode: row.durationCode,
      status: row.status,
      usedContact: row.usedContact || '',
      usedAt: row.usedAt,
      batchNo: row.batchNo || '',
      remark: row.remark || '',
      ownerUserId: row.ownerUserId,
      createdAt: row.createdAt,
      accessExpireAt: row.record ? row.record.accessExpireAt : null
    };
  }

  function formatRedeemRecord(row) {
    return {
      id: row.id,
      redeemNo: `RDM-${row.id}`,
      code: row.code ? row.code.code : '',
      resourceId: row.resourceId,
      shareCode: row.Share ? row.Share.shareCode : '',
      resourceName: row.Share ? row.Share.fileName : '',
      resourceType: row.Share ? row.Share.resourceType : '',
      contact: row.contact,
      redeemedAt: row.redeemedAt,
      accessExpireAt: row.accessExpireAt,
      status: row.status
    };
  }

  async function importRedeemCodes({ authUser, resourceId, content, sourceType }) {
    const share = await Share.findByPk(resourceId);
    if (!share) {
      return { error: '资源不存在' };
    }
    if (authUser.role !== 'admin' && share.userPhone !== authUser.phone) {
      return { error: '只能管理自己发布的资源' };
    }

    const { parsed, errors } = parseRedeemCodeContent(content);
    if (!parsed.length && !errors.length) {
      return { error: '请至少提供一条卡密' };
    }
    if (errors.length) {
      return { error: '解析失败', details: errors };
    }

    const exists = await RedeemCode.findAll({
      where: { code: { [Op.in]: parsed.map((item) => item.code) } },
      attributes: ['code']
    });
    if (exists.length) {
      return {
        error: '存在重复卡密',
        details: exists.map((item) => ({ code: item.code, reason: '数据库中已存在相同卡密' }))
      };
    }

    const owner = await User.findOne({ where: { phone: share.userPhone } });
    if (!owner) {
      return { error: '资源归属用户不存在' };
    }

    const batchNo = generateBatchNo();
    await RedeemCode.bulkCreate(parsed.map((item) => ({
      code: item.code,
      resourceId: share.id,
      ownerUserId: owner.id,
      durationCode: item.durationCode,
      status: 'unused',
      createdByUserId: authUser.id,
      sourceType,
      batchNo
    })));

    return { data: { batchNo, successCount: parsed.length, failedCount: 0 } };
  }

  async function getManageableRedeemCode(id, authUser) {
    const row = await RedeemCode.findByPk(id);
    if (!row) {
      return { error: '卡密不存在', status: 404 };
    }
    if (authUser.role !== 'admin' && row.ownerUserId !== authUser.id) {
      return { error: '无权操作该卡密', status: 403 };
    }
    return { row };
  }

  async function updateRedeemCodeFrozenState({ id, authUser, target }) {
    const result = await getManageableRedeemCode(id, authUser);
    if (result.error) return result;

    const { row } = result;
    if (row.status === 'used') {
      return { error: '已使用的卡密不能变更冻结状态', status: 400 };
    }

    if (target === 'freeze') {
      if (row.status === 'disabled') {
        return { message: '卡密已冻结' };
      }
      row.status = 'disabled';
      row.disabledAt = new Date();
      await row.save();
      return { message: '卡密已冻结' };
    }

    if (row.status !== 'disabled') {
      return { message: '卡密已解冻' };
    }

    row.status = 'unused';
    row.disabledAt = null;
    await row.save();
    return { message: '卡密已解冻' };
  }

  app.get('/api/redeem-codes/resources/options', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const where = authUser.role === 'admin' ? {} : { userPhone: authUser.phone };
      const resources = await Share.findAll({
        where,
        attributes: ['id', 'fileName', 'resourceType', 'shareCode', 'userPhone'],
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: resources.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          resourceType: item.resourceType,
          shareCode: item.shareCode,
          userPhone: item.userPhone
        }))
      });
    } catch (error) {
      console.error('Get redeem resource options error:', error);
      res.status(500).json({ error: '获取资源选项失败' });
    }
  });

  app.get('/api/redeem-codes', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const { keyword = '', status = '', resourceId = '', contact = '', batchNo = '' } = req.query;
      const { page, limit, offset } = parsePaginationParams(req.query, 10, 200);
      const where = {};
      const normalizedKeyword = String(keyword).trim();
      if (status) where.status = status;
      if (resourceId) where.resourceId = Number(resourceId);
      if (contact) where.usedContact = { [Op.like]: `%${String(contact).trim()}%` };
      if (batchNo) where.batchNo = { [Op.like]: `%${String(batchNo).trim()}%` };
      if (authUser.role !== 'admin') where.ownerUserId = authUser.id;
      if (normalizedKeyword) {
        where[Op.or] = [
          { code: { [Op.like]: `%${normalizedKeyword.toUpperCase()}%` } },
          { batchNo: { [Op.like]: `%${normalizedKeyword}%` } },
          { '$Share.fileName$': { [Op.like]: `%${normalizedKeyword}%` } }
        ];
      }

      const result = await RedeemCode.findAndCountAll({
        where,
        include: [
          { model: Share, attributes: ['fileName', 'resourceType', 'shareCode'] },
          { model: RedeemRecord, as: 'record', attributes: ['accessExpireAt'] }
        ],
        order: [['createdAt', 'DESC']],
        distinct: true,
        subQuery: false,
        limit,
        offset
      });

      res.json({
        success: true,
        data: result.rows.map(formatRedeemCode),
        total: Number(result.count || 0),
        page,
        limit
      });
    } catch (error) {
      console.error('Get redeem codes error:', error);
      res.status(500).json({ error: '获取卡密失败' });
    }
  });

  app.post('/api/redeem-codes/import-text', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const { resourceId, content } = req.body;
      if (!resourceId) return res.status(400).json({ error: '请选择资源' });
      const result = await importRedeemCodes({
        authUser,
        resourceId: Number(resourceId),
        content,
        sourceType: 'manual'
      });

      if (result.error) {
        return res.status(400).json({ error: result.error, details: result.details || [] });
      }

      res.json({ success: true, ...result.data });
    } catch (error) {
      console.error('Import redeem codes by text error:', error);
      res.status(500).json({ error: '手动导入卡密失败' });
    }
  });

  app.post('/api/redeem-codes/import-file', authenticateToken, importUpload.single('file'), async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const resourceId = Number(req.body.resourceId || 0);
      if (!resourceId) return res.status(400).json({ error: '请选择资源' });
      if (!req.file) return res.status(400).json({ error: '请上传 .txt 文件' });
      if (!req.file.originalname.toLowerCase().endsWith('.txt')) {
        return res.status(400).json({ error: '仅支持 .txt 文件' });
      }

      const content = req.file.buffer.toString('utf8');
      const result = await importRedeemCodes({
        authUser,
        resourceId,
        content,
        sourceType: 'txt_import'
      });

      if (result.error) {
        return res.status(400).json({ error: result.error, details: result.details || [] });
      }

      res.json({ success: true, ...result.data });
    } catch (error) {
      console.error('Import redeem codes by file error:', error);
      res.status(500).json({ error: '文件导入卡密失败' });
    }
  });

  app.post('/api/redeem-codes/generate', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const resourceId = Number(req.body.resourceId || 0);
      const durationCode = String(req.body.durationCode || '').trim().toLowerCase();
      const countText = String(req.body.count || '').trim();
      const remark = String(req.body.remark || '').trim();

      if (!resourceId) return res.status(400).json({ error: '请选择资源' });
      if (!ALLOWED_DURATION_CODES.has(durationCode)) {
        return res.status(400).json({ error: `有效时长仅支持 ${REDEEM_DURATION_VALUES.join('、')}` });
      }
      if (!/^\d+$/.test(countText)) {
        return res.status(400).json({ error: '生成条数必须为数字' });
      }

      const count = Number.parseInt(countText, 10);
      if (count < 1 || count > 500) {
        return res.status(400).json({ error: '生成条数仅支持 1 到 500 条' });
      }
      if (remark.length > 100) {
        return res.status(400).json({ error: '备注长度不能超过 100 个字符' });
      }

      const share = await Share.findByPk(resourceId);
      if (!share) {
        return res.status(404).json({ error: '资源不存在' });
      }
      if (authUser.role !== 'admin' && share.userPhone !== authUser.phone) {
        return res.status(403).json({ error: '只能管理自己发布的资源' });
      }

      const owner = await User.findOne({ where: { phone: share.userPhone } });
      if (!owner) {
        return res.status(404).json({ error: '资源归属用户不存在' });
      }

      const batchNo = generateBatchNo();
      const codes = await generateUniqueRedeemCodes(count);

      await RedeemCode.bulkCreate(codes.map((code) => ({
        code,
        resourceId: share.id,
        ownerUserId: owner.id,
        durationCode,
        status: 'unused',
        createdByUserId: authUser.id,
        sourceType: 'generated',
        batchNo,
        remark
      })));

      res.json({
        success: true,
        batchNo,
        successCount: count,
        failedCount: 0
      });
    } catch (error) {
      console.error('Generate redeem codes error:', error);
      res.status(500).json({ error: error.message || '生成卡密失败' });
    }
  });

  app.post('/api/redeem-codes/:id/freeze', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const result = await updateRedeemCodeFrozenState({
        id: req.params.id,
        authUser,
        target: 'freeze'
      });

      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error });
      }

      res.json({ success: true, message: result.message || '卡密已冻结' });
    } catch (error) {
      console.error('Freeze redeem code error:', error);
      res.status(500).json({ error: '冻结卡密失败' });
    }
  });

  app.post('/api/redeem-codes/:id/unfreeze', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const result = await updateRedeemCodeFrozenState({
        id: req.params.id,
        authUser,
        target: 'unfreeze'
      });

      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error });
      }

      res.json({ success: true, message: result.message || '卡密已解冻' });
    } catch (error) {
      console.error('Unfreeze redeem code error:', error);
      res.status(500).json({ error: '解冻卡密失败' });
    }
  });

  app.post('/api/redeem-codes/:id/disable', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const result = await updateRedeemCodeFrozenState({
        id: req.params.id,
        authUser,
        target: 'freeze'
      });

      if (result.error) {
        return res.status(result.status || 400).json({ error: result.error });
      }

      res.json({ success: true, message: result.message || '卡密已冻结' });
    } catch (error) {
      console.error('Disable redeem code error:', error);
      res.status(500).json({ error: '冻结卡密失败' });
    }
  });

  app.delete('/api/redeem-codes/:id', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const row = await RedeemCode.findByPk(req.params.id);
      if (!row) return res.status(404).json({ error: '卡密不存在' });
      if (authUser.role !== 'admin' && row.ownerUserId !== authUser.id) {
        return res.status(403).json({ error: '无权删除该卡密' });
      }
      if (row.status === 'used') {
        return res.status(400).json({ error: '已使用的卡密不能删除' });
      }

      await row.destroy();
      res.json({ success: true, message: '卡密已删除' });
    } catch (error) {
      console.error('Delete redeem code error:', error);
      res.status(500).json({ error: '删除卡密失败' });
    }
  });

  app.post('/api/redeem', async (req, res) => {
    if (shouldRequireRedeemCaptcha(req)) {
      const captchaToken = req.body?.captchaToken || req.body?.turnstileToken || req.body?.['cf-turnstile-response'];
      if (!String(captchaToken || '').trim()) {
        return res.status(429).json({
          error: '操作较频繁，请先完成人机验证后重试',
          requiresCaptcha: true,
          code: 'REDEEM_CAPTCHA_REQUIRED'
        });
      }

      const verifyResult = await verifyTurnstileToken(captchaToken, req);
      if (!verifyResult.success) {
        if (verifyResult.misconfigured) {
          return res.status(503).json({ error: '卡密兑换失败：服务器未配置 Turnstile' });
        }
        return res.status(400).json({
          error: verifyResult.error || '卡密兑换未通过人机验证',
          requiresCaptcha: true,
          code: 'REDEEM_CAPTCHA_REQUIRED'
        });
      }
    }

    const transaction = await RedeemCode.sequelize.transaction();
    try {
      const { code, shareCode } = req.body;
      const normalizedCode = String(code || '').trim().toUpperCase();
      const normalizedShareCode = String(shareCode || '').trim().toUpperCase();
      if (!normalizedCode) {
        await transaction.rollback();
        recordRedeemCaptchaAttempt(req, false);
        return res.status(400).json({ error: '卡密不能为空' });
      }

      const row = await RedeemCode.findOne({
        where: { code: normalizedCode },
        include: [{ model: Share, attributes: ['id', 'fileName', 'resourceType', 'shareCode', 'userPhone'] }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!row) {
        await transaction.rollback();
        recordRedeemCaptchaAttempt(req, false);
        return res.status(404).json({ error: '卡密不存在' });
      }
      if (normalizedShareCode && row.Share && row.Share.shareCode !== normalizedShareCode) {
        await transaction.rollback();
        recordRedeemCaptchaAttempt(req, false);
        return res.status(400).json({ error: '当前卡密与此资源不匹配' });
      }
      if (row.status === 'disabled') {
        await transaction.rollback();
        recordRedeemCaptchaAttempt(req, false);
        return res.status(400).json({ error: '卡密已冻结' });
      }

      const authUser = await resolveOptionalAuthUser(req);
      const now = new Date();

      if (row.status === 'used') {
        const record = await RedeemRecord.findOne({
          where: { codeId: row.id },
          order: [['redeemedAt', 'DESC']],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (!record) {
          await transaction.rollback();
          recordRedeemCaptchaAttempt(req, false);
          return res.status(400).json({ error: '卡密已使用，但授权记录不存在' });
        }
        if (record.status === 'revoked') {
          await transaction.rollback();
          recordRedeemCaptchaAttempt(req, false);
          return res.status(400).json({ error: '当前卡密授权已撤销' });
        }
        if (!record.accessExpireAt || new Date(record.accessExpireAt).getTime() <= now.getTime()) {
          await transaction.rollback();
          recordRedeemCaptchaAttempt(req, false);
          return res.status(400).json({ error: '授权已过期，请获取新的卡密' });
        }

        const accessToken = signRedeemAccessToken({
          shareId: row.resourceId,
          codeId: row.id,
          accessExpireAt: record.accessExpireAt
        });

        await transaction.commit();
        recordRedeemCaptchaAttempt(req, true);
        return res.json({
          success: true,
          data: {
            redeemNo: generateRedeemNo(),
            redeemedAt: record.redeemedAt,
            accessExpireAt: record.accessExpireAt,
            accessToken,
            resource: row.Share
              ? {
                id: row.Share.id,
                shareCode: row.Share.shareCode,
                fileName: row.Share.fileName,
                resourceType: row.Share.resourceType
              }
              : null
          }
        });
      }

      const durationMs = parseDurationToMs(row.durationCode);
      const accessExpireAt = new Date(now.getTime() + durationMs);

      const record = await RedeemRecord.create({
        codeId: row.id,
        resourceId: row.resourceId,
        ownerUserId: row.ownerUserId,
        redeemedByUserId: authUser ? authUser.id : null,
        contact: '',
        redeemedAt: now,
        accessStartAt: now,
        accessExpireAt,
        status: 'active'
      }, { transaction });

      row.status = 'used';
      row.usedByUserId = authUser ? authUser.id : null;
      row.usedContact = '';
      row.usedAt = now;
      await row.save({ transaction });

      const accessToken = signRedeemAccessToken({
        shareId: row.resourceId,
        codeId: row.id,
        accessExpireAt: record.accessExpireAt
      });

      await transaction.commit();
      recordRedeemCaptchaAttempt(req, true);
      res.json({
        success: true,
        data: {
          redeemNo: generateRedeemNo(),
          redeemedAt: record.redeemedAt,
          accessExpireAt: record.accessExpireAt,
          accessToken,
          resource: row.Share
            ? {
              id: row.Share.id,
              shareCode: row.Share.shareCode,
              fileName: row.Share.fileName,
              resourceType: row.Share.resourceType
            }
            : null
        }
      });
    } catch (error) {
      await transaction.rollback();
      recordRedeemCaptchaAttempt(req, false);
      console.error('Redeem code error:', error);
      res.status(500).json({ error: '卡密兑换失败' });
    }
  });

  app.get('/api/redeem-records', authenticateToken, async (req, res) => {
    try {
      const authUser = await requireAuthUser(req, res);
      if (!authUser) return;

      const { keyword = '', status = '', contact = '' } = req.query;
      const { page, limit, offset } = parsePaginationParams(req.query, 10, 200);
      const where = {};
      const normalizedKeyword = String(keyword).trim();
      if (authUser.role !== 'admin') where.ownerUserId = authUser.id;
      if (status) where.status = status;
      if (contact) where.contact = { [Op.like]: `%${String(contact).trim()}%` };
      if (normalizedKeyword) {
        where[Op.or] = [
          { contact: { [Op.like]: `%${normalizedKeyword}%` } },
          { '$Share.fileName$': { [Op.like]: `%${normalizedKeyword}%` } },
          { '$Share.shareCode$': { [Op.like]: `%${normalizedKeyword.toUpperCase()}%` } },
          { '$code.code$': { [Op.like]: `%${normalizedKeyword.toUpperCase()}%` } }
        ];
      }

      const result = await RedeemRecord.findAndCountAll({
        where,
        include: [
          { model: Share, attributes: ['fileName', 'resourceType', 'shareCode'] },
          { model: RedeemCode, as: 'code', attributes: ['code'] }
        ],
        order: [['redeemedAt', 'DESC']],
        distinct: true,
        subQuery: false,
        limit,
        offset
      });

      res.json({
        success: true,
        data: result.rows.map(formatRedeemRecord),
        total: Number(result.count || 0),
        page,
        limit
      });
    } catch (error) {
      console.error('Get redeem records error:', error);
      res.status(500).json({ error: '获取兑换记录失败' });
    }
  });
}

module.exports = {
  createRedeemHelpers,
  registerRedeemRoutes,
};
