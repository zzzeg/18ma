<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { authApi, profileApi } from '../api/services'
import { useAppStore } from '../stores/app'
import { initials, maskPhone } from '../utils/utils'

type ProfileSection = 'info' | 'preferences' | 'security' | 'account'

interface SecurityLogRow {
  id: string
  detail: string
  ip: string
  location: string
  os: string
  browser: string
  time: string
}

interface StoredProfileState {
  avatar: string
  email: string
  contactPhone: string
  bio: string
  preferences: {
    accountPassword: boolean
    systemMessage: boolean
    todoTask: boolean
  }
  securityQuestion: string
  securityAnswer: string
  backupEmail: string
  logs: SecurityLogRow[]
}

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const savingProfile = ref(false)
const passwordLoading = ref(false)
const passwordDialogVisible = ref(false)
const backupEmailDialogVisible = ref(false)
const securityQuestionDialogVisible = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
const activeSection = ref<ProfileSection>('info')
const logCurrentPage = ref(1)
const logPageSize = ref(10)
const avatarUrl = ref('')
const securityLogs = ref<SecurityLogRow[]>([])
const securityQuestion = ref('')
const securityAnswer = ref('')
const backupEmail = ref('')
const profileForm = ref({
  nickname: '',
  email: '',
  contactPhone: '',
  bio: '',
})
const preferences = ref({
  accountPassword: true,
  systemMessage: true,
  todoTask: true,
})
const passwordForm = ref({
  password: '',
  confirmPassword: '',
})
const backupEmailForm = ref({
  email: '',
})
const securityQuestionForm = ref({
  question: '',
  answer: '',
})

const preferenceItems = computed(() => [
  {
    key: 'accountPassword' as const,
    title: '账户密码',
    description: '其他用户的消息将以站内信的形式通知',
  },
  {
    key: 'systemMessage' as const,
    title: '系统消息',
    description: '系统消息将以站内信的形式通知',
  },
  {
    key: 'todoTask' as const,
    title: '待办任务',
    description: '待办任务将以站内信的形式通知',
  },
])

const avatarText = computed(() => initials(profileForm.value.nickname || store.nickname || 'RC'))
const profileStorageKey = computed(() => `rc_profile_center_${store.phone || 'guest'}`)
const isEmailLoginAccount = computed(() => String(store.phone || '').includes('@'))
const maskedLoginAccount = computed(() => {
  const account = String(store.phone || '').trim()
  if (!account) return '--'
  return isEmailLoginAccount.value ? maskEmail(account) : maskPhone(account)
})
const pagedSecurityLogs = computed(() => {
  const start = (logCurrentPage.value - 1) * logPageSize.value
  return securityLogs.value.slice(start, start + logPageSize.value)
})
const maskedBackupEmail = computed(() => {
  const value = backupEmail.value || profileForm.value.email
  return maskEmail(value)
})
const accountRows = computed(() => [
  {
    key: 'password',
    title: '账户密码',
    description: '当前密码强度：强',
  },
  {
    key: 'phone',
    title: isEmailLoginAccount.value ? '登录邮箱' : '密保手机',
    description: `${isEmailLoginAccount.value ? '当前登录邮箱' : '已经绑定手机'}：${maskedLoginAccount.value}`,
  },
  {
    key: 'question',
    title: '密保问题',
    description: securityQuestion.value
      ? `已设置密保问题：${securityQuestion.value}`
      : '未设置密保问题，密保问题可有效保护账户安全',
  },
  {
    key: 'email',
    title: '备用邮箱',
    description: backupEmail.value || profileForm.value.email
      ? `已绑定邮箱：${maskedBackupEmail.value}`
      : '未设置备用邮箱，建议尽快补充',
  },
])

function normalizeSection(value: unknown): ProfileSection {
  const section = String(value || '').trim()
  if (section === 'preferences' || section === 'security' || section === 'account') return section
  return 'info'
}

function resolveClientMeta() {
  if (typeof navigator === 'undefined') {
    return { os: 'Unknown', browser: 'Unknown' }
  }

  const ua = navigator.userAgent
  let os = 'Unknown'
  let browser = 'Unknown'

  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Linux/i.test(ua)) os = 'Linux'

  if (/Edg/i.test(ua)) browser = 'Edge'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua)) browser = 'Safari'

  return { os, browser }
}

function formatLogTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function buildLog(detail: string, time = formatLogTime()): SecurityLogRow {
  const meta = resolveClientMeta()
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    detail,
    ip: '127.0.0.1',
    location: '本地开发环境',
    os: meta.os,
    browser: meta.browser,
    time: typeof time === 'string' && time.includes('T') ? formatLogTime(new Date(time)) : time,
  }
}

function buildDefaultState(contactFallback = ''): StoredProfileState {
  const bindLogDetail = isEmailLoginAccount.value ? '绑定了邮箱账号' : '绑定了手机号码'
  return {
    avatar: '',
    email: '',
    contactPhone: contactFallback || store.phone || '',
    bio: '一个热爱开源的前端工程师',
    preferences: {
      accountPassword: true,
      systemMessage: true,
      todoTask: true,
    },
    securityQuestion: '',
    securityAnswer: '',
    backupEmail: '',
    logs: [
      buildLog('账户登录'),
      buildLog(bindLogDetail, formatLogTime(new Date(Date.now() - 24 * 60 * 60 * 1000))),
    ],
  }
}

function readStoredState(contactFallback = ''): StoredProfileState {
  const defaults = buildDefaultState(contactFallback)
  try {
    const raw = window.localStorage.getItem(profileStorageKey.value)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<StoredProfileState>
    return {
      avatar: parsed.avatar || defaults.avatar,
      email: parsed.email || '',
      contactPhone: parsed.contactPhone || defaults.contactPhone,
      bio: parsed.bio || defaults.bio,
      preferences: {
        accountPassword: parsed.preferences?.accountPassword ?? defaults.preferences.accountPassword,
        systemMessage: parsed.preferences?.systemMessage ?? defaults.preferences.systemMessage,
        todoTask: parsed.preferences?.todoTask ?? defaults.preferences.todoTask,
      },
      securityQuestion: parsed.securityQuestion || '',
      securityAnswer: parsed.securityAnswer || '',
      backupEmail: parsed.backupEmail || '',
      logs: Array.isArray(parsed.logs) && parsed.logs.length ? parsed.logs : defaults.logs,
    }
  } catch {
    return defaults
  }
}

function persistStoredState() {
  const payload: StoredProfileState = {
    avatar: avatarUrl.value,
    email: profileForm.value.email.trim(),
    contactPhone: profileForm.value.contactPhone.trim(),
    bio: profileForm.value.bio.trim(),
    preferences: { ...preferences.value },
    securityQuestion: securityQuestion.value.trim(),
    securityAnswer: securityAnswer.value.trim(),
    backupEmail: backupEmail.value.trim(),
    logs: [...securityLogs.value],
  }
  window.localStorage.setItem(profileStorageKey.value, JSON.stringify(payload))
}

function pushSecurityLog(detail: string) {
  securityLogs.value = [buildLog(detail), ...securityLogs.value].slice(0, 50)
  persistStoredState()
}

function changeSection(section: ProfileSection) {
  activeSection.value = section
  if (route.query.section !== section) {
    void router.replace({ query: { ...route.query, section } })
  }
}

function openAvatarPicker() {
  avatarInput.value?.click()
}

function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const picked = input.files?.[0]
  if (!picked) return
  if (picked.size > 2 * 1024 * 1024) {
    ElMessage.warning('头像图片请控制在 2MB 以内')
    input.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    avatarUrl.value = String(reader.result || '')
    persistStoredState()
    pushSecurityLog('更新头像')
    ElMessage.success('头像已更新')
  }
  reader.readAsDataURL(picked)
  input.value = ''
}

function maskEmail(value: string) {
  if (!value || !value.includes('@')) return value || '未绑定'
  const [name, domain] = value.split('@')
  if (!name || !domain) return value
  if (name.length <= 2) return `${name[0] || '*'}***@${domain}`
  return `${name.slice(0, 4)}***@${domain}`
}

async function loadProfile() {
  loading.value = true
  try {
    const result = await profileApi.getProfile()
    store.applyProfile(result)
    const stored = readStoredState(result.contact || '')
    profileForm.value.nickname = result.nickname || ''
    profileForm.value.email = stored.email || ''
    profileForm.value.contactPhone = stored.contactPhone || result.contact || store.phone || ''
    profileForm.value.bio = stored.bio
    avatarUrl.value = stored.avatar
    preferences.value = { ...stored.preferences }
    securityQuestion.value = stored.securityQuestion
    securityAnswer.value = stored.securityAnswer
    backupEmail.value = stored.backupEmail || stored.email || ''
    securityLogs.value = [...stored.logs]
    backupEmailForm.value.email = backupEmail.value
    securityQuestionForm.value.question = securityQuestion.value
    securityQuestionForm.value.answer = securityAnswer.value
    persistStoredState()
  } catch {
    // interceptor handles unauthorized case
  } finally {
    loading.value = false
  }
}

async function savePersonalInfo() {
  if (!profileForm.value.nickname.trim()) {
    ElMessage.warning('请输入昵称')
    return
  }

  if (profileForm.value.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.value.email.trim())) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }

  savingProfile.value = true
  try {
    const payload = {
      nickname: profileForm.value.nickname.trim(),
      contact: profileForm.value.contactPhone.trim() || profileForm.value.email.trim(),
    }
    const result = await profileApi.updateProfile(payload)
    store.applyProfile(result)
    persistStoredState()
    pushSecurityLog('更新个人信息')
    ElMessage.success('更新信息成功')
  } catch (error: any) {
    ElMessage.error(error.error || '保存失败')
  } finally {
    savingProfile.value = false
  }
}

function handlePreferenceChange(detail: string) {
  persistStoredState()
  pushSecurityLog(`更新偏好设置：${detail}`)
}

function openPasswordDialog() {
  passwordForm.value = { password: '', confirmPassword: '' }
  passwordDialogVisible.value = true
}

async function submitPasswordUpdate() {
  if (!passwordForm.value.password.trim()) {
    ElMessage.warning('请输入新密码')
    return
  }
  if (passwordForm.value.password.trim().length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  passwordLoading.value = true
  try {
    await authApi.updatePassword(passwordForm.value.password.trim())
    passwordDialogVisible.value = false
    pushSecurityLog('修改账户密码')
    ElMessage.success('密码已更新')
  } catch (error: any) {
    ElMessage.error(error.error || '密码更新失败')
  } finally {
    passwordLoading.value = false
  }
}

function openBackupEmailDialog() {
  backupEmailForm.value.email = backupEmail.value || profileForm.value.email
  backupEmailDialogVisible.value = true
}

function submitBackupEmail() {
  const nextEmail = backupEmailForm.value.email.trim()
  if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    ElMessage.warning('请输入正确的备用邮箱地址')
    return
  }
  backupEmail.value = nextEmail
  persistStoredState()
  pushSecurityLog('更新备用邮箱')
  backupEmailDialogVisible.value = false
  ElMessage.success('备用邮箱已更新')
}

function openSecurityQuestionDialog() {
  securityQuestionForm.value.question = securityQuestion.value
  securityQuestionForm.value.answer = securityAnswer.value
  securityQuestionDialogVisible.value = true
}

function submitSecurityQuestion() {
  if (!securityQuestionForm.value.question.trim() || !securityQuestionForm.value.answer.trim()) {
    ElMessage.warning('请完整填写密保问题和答案')
    return
  }
  securityQuestion.value = securityQuestionForm.value.question.trim()
  securityAnswer.value = securityQuestionForm.value.answer.trim()
  persistStoredState()
  pushSecurityLog('更新密保问题')
  securityQuestionDialogVisible.value = false
  ElMessage.success('密保问题已更新')
}

function handleAccountAction(key: string) {
  if (key === 'password') {
    openPasswordDialog()
    return
  }
  if (key === 'phone') {
    changeSection('info')
    ElMessage.info('请在个人信息里调整展示联系电话')
    return
  }
  if (key === 'question') {
    openSecurityQuestionDialog()
    return
  }
  if (key === 'email') {
    openBackupEmailDialog()
  }
}

watch(
  () => route.query.section,
  (value) => {
    activeSection.value = normalizeSection(value)
  },
  { immediate: true },
)

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="page-shell profile-page" v-loading="loading">
    <section class="panel account-panel">
      <div class="account-body">
        <section v-if="activeSection === 'info'" class="account-section">
          <h2>个人信息</h2>

          <div class="avatar-editor">
            <label>头像</label>
            <div class="avatar-editor__content">
              <div class="avatar-editor__preview">
                <img v-if="avatarUrl" :src="avatarUrl" alt="avatar preview" />
                <span v-else>{{ avatarText }}</span>
              </div>
              <input ref="avatarInput" type="file" accept="image/*" hidden @change="handleAvatarChange" />
              <el-button plain @click="openAvatarPicker">更新头像</el-button>
            </div>
          </div>

          <el-form class="profile-form" label-position="top">
            <el-form-item label="昵称">
              <el-input v-model="profileForm.nickname" placeholder="请输入昵称" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="profileForm.email" placeholder="请输入邮箱地址" />
            </el-form-item>
            <el-form-item label="联系电话">
              <el-input v-model="profileForm.contactPhone" placeholder="请输入联系电话" />
            </el-form-item>
            <el-form-item label="简介">
              <el-input v-model="profileForm.bio" type="textarea" :rows="5" placeholder="请输入个人简介" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="savingProfile" @click="savePersonalInfo">更新信息</el-button>
            </el-form-item>
          </el-form>
        </section>

        <section v-else-if="activeSection === 'preferences'" class="account-section">
          <h2>偏好设置</h2>

          <div class="preference-list">
            <article v-for="item in preferenceItems" :key="item.key" class="preference-item">
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <el-switch
                v-model="preferences[item.key]"
                inline-prompt
                active-text="是"
                inactive-text="否"
                @change="handlePreferenceChange(item.title)"
              />
            </article>
          </div>
        </section>

        <section v-else-if="activeSection === 'security'" class="account-section">
          <h2>安全日志</h2>

          <el-table :data="pagedSecurityLogs">
            <el-table-column prop="detail" label="详情" min-width="160" />
            <el-table-column prop="ip" label="IP 地址" min-width="140" />
            <el-table-column prop="location" label="地点" min-width="160" />
            <el-table-column prop="os" label="操作系统" min-width="120" />
            <el-table-column prop="browser" label="浏览器类型" min-width="120" />
            <el-table-column prop="time" label="时间" min-width="190" />
          </el-table>

          <div class="table-pagination">
            <el-pagination
              v-model:current-page="logCurrentPage"
              v-model:page-size="logPageSize"
              layout="total, sizes, prev, pager, next, jumper"
              :total="securityLogs.length"
              :page-sizes="[10, 20, 30, 50]"
              @size-change="logCurrentPage = 1"
            />
          </div>
        </section>

        <section v-else class="account-section">
          <h2>账户管理</h2>

          <div class="manage-list">
            <article v-for="item in accountRows" :key="item.key" class="manage-item">
              <div class="manage-item__copy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
              <button class="manage-item__action" @click="handleAccountAction(item.key)">修改</button>
            </article>
          </div>
        </section>
      </div>
    </section>

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px">
      <div class="dialog-form">
        <el-input v-model="passwordForm.password" type="password" placeholder="请输入新密码" show-password />
        <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
      </div>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordLoading" @click="submitPasswordUpdate">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="backupEmailDialogVisible" title="备用邮箱" width="420px">
      <div class="dialog-form">
        <el-input v-model="backupEmailForm.email" placeholder="请输入备用邮箱地址" />
      </div>
      <template #footer>
        <el-button @click="backupEmailDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBackupEmail">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="securityQuestionDialogVisible" title="密保问题" width="460px">
      <div class="dialog-form">
        <el-input v-model="securityQuestionForm.question" placeholder="请输入密保问题" />
        <el-input v-model="securityQuestionForm.answer" placeholder="请输入密保答案" />
      </div>
      <template #footer>
        <el-button @click="securityQuestionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitSecurityQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  display: grid;
  gap: 16px;
}

.account-panel {
  padding: 26px 34px 30px;
  min-height: 620px;
}

.account-body {
  width: 100%;
}

.account-section {
  h2 {
    margin: 0 0 28px;
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }
}

.avatar-editor {
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  &__content {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  &__preview {
    width: 78px;
    height: 78px;
    border-radius: 50%;
    overflow: hidden;
    background: #f5f7fa;
    color: var(--rc-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 700;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }
}

.profile-form {
  max-width: 760px;

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    padding-bottom: 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--rc-text);
  }
}

.preference-list {
  max-width: 880px;
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0 24px;
  border-bottom: 1px solid var(--rc-border);

  & + & {
    padding-top: 24px;
  }

  strong {
    display: block;
    font-size: 15px;
    font-weight: 600;
    color: var(--rc-text);
  }

  p {
    margin: 8px 0 0;
    color: var(--rc-text-soft);
    line-height: 1.8;
  }
}

.manage-list {
  max-width: 900px;
}

.manage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0 24px;
  border-bottom: 1px solid var(--rc-border);

  &:first-child {
    padding-top: 0;
  }

  &__copy {
    strong {
      display: block;
      font-size: 15px;
      font-weight: 600;
      color: var(--rc-text);
    }

    p {
      margin: 8px 0 0;
      color: var(--rc-text-soft);
      line-height: 1.8;
    }
  }

  &__action {
    border: none;
    background: transparent;
    color: var(--rc-primary);
    cursor: pointer;
    font-size: 14px;
    padding: 0;
  }
}

.dialog-form {
  display: grid;
  gap: 12px;
}

@media (max-width: 960px) {
  .account-body {
    width: 100%;
  }

  .preference-item,
  .manage-item,
  .avatar-editor__content {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-panel {
    padding: 22px 18px 24px;
  }
}
</style>
