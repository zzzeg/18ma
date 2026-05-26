<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, Download, Lock, TopRight } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import TurnstileWidget from '../components/TurnstileWidget.vue'
import { redeemApi, shareApi, type ShareRecord } from '../api/services'
import { useAppStore } from '../stores/app'
import { copyToClipboard, formatDate, formatFileSize } from '../utils/utils'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const loading = ref(false)
const submitting = ref(false)
const downloading = ref(false)
const captchaRequired = ref(false)
const captchaToken = ref('')
const captchaRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const share = ref<ShareRecord | null>(null)
const redeemCode = ref('')
let expireTimer: number | null = null

const isAuthenticated = computed(() => store.isAuthenticated)
const routeCode = computed(() => String(route.params.code || '').trim())
const activeShareCode = computed(() => String(share.value?.shareCode || routeCode.value).trim())
const canAccess = computed(() => Boolean(share.value?.isPaid))
const deliveryFileName = computed(() => share.value?.uploadedFileName || '--')
const subtitleText = computed(() => share.value?.note?.trim() || '——')
const dynamicDownloadLink = computed(() => {
  const code = activeShareCode.value
  const token = getSavedAccessToken(code)
  if (!code || !token || !share.value || share.value.resourceType !== 'file') return ''
  return `${window.location.origin}/api/download/${code}?accessToken=${encodeURIComponent(token)}`
})
function resourceTypeText(type?: ShareRecord['resourceType']) {
  return ({ file: '文件', cloud: '网盘', url: '链接', text: '文本信息' } as Record<string, string>)[type || ''] || '资源'
}

function getAccessTokenKey(code: string) {
  return code ? `redeem_access_${code}` : ''
}

function getSavedAccessToken(code: string) {
  const key = getAccessTokenKey(code)
  if (!key) return ''
  return window.sessionStorage.getItem(key) || ''
}

function saveAccessToken(code: string, token: string) {
  const key = getAccessTokenKey(code)
  if (!key) return
  window.sessionStorage.setItem(key, token)
}

function clearAccessToken(code: string) {
  const key = getAccessTokenKey(code)
  if (!key) return
  window.sessionStorage.removeItem(key)
}

function clearExpireTimer() {
  if (expireTimer !== null) {
    window.clearTimeout(expireTimer)
    expireTimer = null
  }
}

function resetCaptcha() {
  captchaToken.value = ''
  captchaRef.value?.reset()
}

function lockShareState() {
  if (!share.value) return
  share.value.isPaid = false
  share.value.authorizationStatus = 'locked'
  share.value.accessExpireAt = null
  delete share.value.cloudUrl
  delete share.value.extractionCode
  delete share.value.url
  delete share.value.content
  delete share.value.autoRedirect
  delete share.value.note
  delete share.value.uploadedFileName
}

function scheduleExpireRefresh(expireAt?: string | null) {
  clearExpireTimer()
  if (!expireAt) return

  const expireTime = new Date(expireAt).getTime()
  if (Number.isNaN(expireTime)) return

  const delay = expireTime - Date.now()
  if (delay <= 0) {
    clearAccessToken(activeShareCode.value)
    lockShareState()
    return
  }

  expireTimer = window.setTimeout(() => {
    clearAccessToken(activeShareCode.value)
    lockShareState()
    ElMessage.warning('授权已过期，内容已重新锁定')
  }, delay)
}

async function loadShare(shareCode = routeCode.value) {
  if (!shareCode) {
    share.value = null
    clearExpireTimer()
    return
  }

  loading.value = true
  try {
    share.value = await shareApi.getShare(shareCode, getSavedAccessToken(shareCode) || undefined)
  } catch (error: any) {
    share.value = null
    ElMessage.error(error.error || '资源加载失败')
  } finally {
    loading.value = false
  }
}

async function bootstrapRoute() {
  clearExpireTimer()
  captchaRequired.value = false
  resetCaptcha()
  redeemCode.value = ''
  await loadShare(routeCode.value)
}

async function submitRedeem() {
  const normalizedCode = redeemCode.value.trim().toUpperCase()
  if (!normalizedCode) {
    ElMessage.warning('请输入卡密')
    return
  }
  if (captchaRequired.value && !captchaToken.value) {
    ElMessage.warning('请先完成人机验证')
    return
  }
  if (!routeCode.value) {
    ElMessage.warning('当前资源入口无效')
    return
  }

  submitting.value = true
  try {
    const result = await redeemApi.redeem({
      code: normalizedCode,
      shareCode: routeCode.value,
      captchaToken: captchaToken.value || undefined,
    })
    const resolvedShareCode = result.data.resource?.shareCode || routeCode.value
    saveAccessToken(resolvedShareCode, result.data.accessToken)
    redeemCode.value = normalizedCode
    captchaRequired.value = false

    if (resolvedShareCode !== routeCode.value) {
      await router.replace(`/share/${resolvedShareCode}`)
      return
    }

    await loadShare(routeCode.value)
    ElMessage.success('卡密验证成功，当前资源已授权')
  } catch (error: any) {
    if (error?.requiresCaptcha || error?.code === 'REDEEM_CAPTCHA_REQUIRED') {
      captchaRequired.value = true
      ElMessage.warning(error.error || '操作较频繁，请先完成人机验证后重试')
      return
    }
    ElMessage.error(error.error || error.message || '兑换失败')
  } finally {
    submitting.value = false
    resetCaptcha()
  }
}

async function copyValue(value: string, successText: string) {
  if (!value) {
    ElMessage.warning('当前内容为空')
    return
  }
  await copyToClipboard(value)
  ElMessage.success(successText)
}

function openExternalUrl(url?: string) {
  if (!url) {
    ElMessage.warning('当前链接不可用')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function copyDownloadLink() {
  if (!dynamicDownloadLink.value) {
    ElMessage.warning('当前下载链接暂不可用')
    return
  }
  await copyToClipboard(dynamicDownloadLink.value)
  ElMessage.success('下载链接已复制')
}

async function downloadFile() {
  const code = activeShareCode.value
  if (!code || !share.value || share.value.resourceType !== 'file') {
    ElMessage.warning('当前资源暂无可下载文件')
    return
  }

  downloading.value = true
  try {
    const token = getSavedAccessToken(code)
    const result = await shareApi.download(code, token ? { accessToken: token } : undefined)
    const downloadName = result.fileName || share.value.downloadFileName || `${code}.dat`
    const objectUrl = window.URL.createObjectURL(result.blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = downloadName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(objectUrl)
  } catch (error: any) {
    ElMessage.error(error.error || '文件下载失败')
  } finally {
    downloading.value = false
  }
}

function logout() {
  store.logout()
  ElMessage.success('已退出登录')
}

watch(
  routeCode,
  () => {
    void bootstrapRoute()
  },
  { immediate: true },
)

watch(
  () => share.value?.accessExpireAt,
  (expireAt) => {
    scheduleExpireRefresh(expireAt)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearExpireTimer()
})
</script>

<template>
  <div class="share-page">
    <header class="header glass-panel public-header">
      <div class="public-header__inner">
        <div class="header__left">
          <div class="header__brand-wrap">
            <span class="header__brand-mark">R</span>
            <button class="header__brand" @click="router.push('/index')">RegCode</button>
          </div>
        </div>
        <div class="header__right">
          <template v-if="isAuthenticated">
            <button class="header__link" @click="router.push('/dashboard')">【分享者中心】</button>
            <button class="header__link" @click="logout">【退出】</button>
          </template>
          <template v-else>
            <button class="header__link" @click="router.push('/login')">【登录】</button>
            <button class="header__link" @click="router.push('/register')">【注册分享者】</button>
          </template>
        </div>
      </div>
    </header>

    <main class="share-shell" v-loading="loading">
      <template v-if="share">
        <section class="panel share-shell__hero">
          <div class="share-shell__hero-copy">
            <span class="share-shell__eyebrow">资源详情</span>
            <h1>{{ share.fileName }}</h1>
            <p>{{ subtitleText }}</p>
          </div>
          <div class="share-shell__hero-meta">
            <div class="share-shell__hero-item">
              <small>交付类型</small>
              <strong>{{ resourceTypeText(share.resourceType) }}</strong>
            </div>
            <div class="share-shell__hero-item">
              <small>当前状态</small>
              <strong :class="{ 'is-success': canAccess }">{{ canAccess ? '已解锁' : '待解锁' }}</strong>
            </div>
          </div>
        </section>

        <section class="share-shell__grid">
          <section class="panel content-card">
            <div class="content-card__head">
              <div>
                <h2>{{ canAccess ? '资源内容' : '待解锁内容' }}</h2>
                <p>{{ canAccess ? '当前授权有效，可查看该资源的完整交付内容。' : '输入卡密后，即可查看当前资源的完整内容。' }}</p>
              </div>
            </div>

            <div v-if="canAccess" class="content-card__block content-card__block--granted">
              <template v-if="share.resourceType === 'file'">
                <div class="content-fields">
                  <div class="content-field">
                    <span class="content-field__label">文件名</span>
                    <div class="content-field__value content-field__value--accent">{{ deliveryFileName }}</div>
                  </div>
                  <div class="content-field">
                    <span class="content-field__label">文件大小</span>
                    <div class="content-field__value">{{ formatFileSize(share.fileSize) }}</div>
                  </div>
                  <div class="content-field content-field--full">
                    <span class="content-field__label">备注</span>
                    <div class="content-field__value">{{ share.note?.trim() || '——' }}</div>
                  </div>
                </div>
                <div class="content-card__actions">
                  <el-button type="success" :icon="Download" :loading="downloading" @click="downloadFile">下载文件</el-button>
                  <el-button v-if="dynamicDownloadLink" plain :icon="DocumentCopy" @click="copyDownloadLink">复制下载链接</el-button>
                </div>
              </template>

              <template v-else-if="share.resourceType === 'cloud'">
                <div class="content-fields">
                  <div class="content-field content-field--full">
                    <span class="content-field__label">网盘链接</span>
                    <div class="content-field__value content-field__value--break">{{ share.cloudUrl || '--' }}</div>
                  </div>
                  <div class="content-field">
                    <span class="content-field__label">提取码</span>
                    <div class="content-field__value">{{ share.extractionCode || '无' }}</div>
                  </div>
                  <div class="content-field content-field--full">
                    <span class="content-field__label">备注</span>
                    <div class="content-field__value">{{ share.note?.trim() || '——' }}</div>
                  </div>
                </div>
                <div class="content-card__actions">
                  <el-button type="primary" :icon="TopRight" @click="openExternalUrl(share.cloudUrl)">打开网盘链接</el-button>
                  <el-button plain :icon="DocumentCopy" @click="copyValue(share.cloudUrl || '', '网盘链接已复制')">复制网盘链接</el-button>
                  <el-button v-if="share.extractionCode" plain :icon="DocumentCopy" @click="copyValue(share.extractionCode, '提取码已复制')">复制提取码</el-button>
                </div>
              </template>

              <template v-else-if="share.resourceType === 'url'">
                <div class="content-fields">
                  <div class="content-field content-field--full">
                    <span class="content-field__label">目标链接</span>
                    <div class="content-field__value content-field__value--break">{{ share.url || '--' }}</div>
                  </div>
                  <div class="content-field">
                    <span class="content-field__label">跳转方式</span>
                    <div class="content-field__value">{{ share.autoRedirect ? '自动跳转已开启' : '手动打开链接' }}</div>
                  </div>
                  <div class="content-field content-field--full">
                    <span class="content-field__label">备注</span>
                    <div class="content-field__value">{{ share.note?.trim() || '——' }}</div>
                  </div>
                </div>
                <div class="content-card__actions">
                  <el-button type="primary" :icon="TopRight" @click="openExternalUrl(share.url)">打开链接</el-button>
                  <el-button plain :icon="DocumentCopy" @click="copyValue(share.url || '', '链接已复制')">复制链接</el-button>
                </div>
              </template>

              <template v-else>
                <div class="content-fields">
                  <div class="content-field content-field--full">
                    <span class="content-field__label">文本内容</span>
                    <div class="content-field__value content-field__value--text">{{ share.content || '——' }}</div>
                  </div>
                  <div class="content-field content-field--full">
                    <span class="content-field__label">备注</span>
                    <div class="content-field__value">{{ share.note?.trim() || '——' }}</div>
                  </div>
                </div>
                <div class="content-card__actions">
                  <el-button plain :icon="DocumentCopy" @click="copyValue(share.content || '', '文本内容已复制')">复制文本内容</el-button>
                </div>
              </template>
            </div>

            <div v-else class="content-card__block content-card__block--locked">
              <div class="content-card__notice">
                <el-icon><Lock /></el-icon>
                <div>
                  <strong>输入卡密解锁内容</strong>
                  <p>卡密验证通过后，即可查看当前资源的完整交付内容。</p>
                </div>
              </div>
            </div>
          </section>

          <aside class="share-shell__aside">
            <section class="panel unlock-card">
              <div class="unlock-card__head">
                <h3>{{ canAccess ? '授权状态' : '卡密验证' }}</h3>
                <span>{{ canAccess ? '当前内容已解锁' : '仅当前资源可使用' }}</span>
              </div>

              <template v-if="canAccess">
                <div class="unlock-card__success">
                  <strong>{{ share.authorizationStatus === 'owner' ? '当前账号为资源发布者' : '当前卡密授权有效' }}</strong>
                  <p>{{ share.accessExpireAt ? `授权到期：${formatDate(share.accessExpireAt)}` : '当前访问权限可正常使用。' }}</p>
                </div>
              </template>

              <template v-else>
                <el-input
                  v-model="redeemCode"
                  maxlength="64"
                  placeholder="请输入卡密"
                  @keyup.enter="submitRedeem"
                />
                <p v-if="captchaRequired" class="unlock-card__hint">当前验证请求较频繁，请先完成人机验证。</p>
                <TurnstileWidget
                  v-if="captchaRequired"
                  ref="captchaRef"
                  v-model="captchaToken"
                  action="redeem"
                  class="unlock-card__captcha"
                />
                <el-button type="primary" :loading="submitting" @click="submitRedeem">验证卡密</el-button>
              </template>
            </section>
          </aside>
        </section>
      </template>

      <section v-else class="panel share-empty">
        <h2>资源不存在或已下架</h2>
        <p>请检查链接是否正确，或返回首页重新输入卡密。</p>
        <el-button type="primary" @click="router.push('/index')">返回首页</el-button>
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.share-page {
  min-height: 100vh;
  padding-bottom: 40px;
}

.header.public-header {
  position: sticky;
  top: 0;
  z-index: 30;
  width: 100%;
  padding: 12px 18px;
  border-radius: 0;
  border: none;
  background: var(--rc-primary);
  box-shadow: var(--rc-shadow-soft);
}

.public-header__inner {
  width: min(1400px, 100%);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.header__left,
.header__right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header__brand-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header__brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.header__brand,
.header__link {
  border: none;
  cursor: pointer;
  background: transparent;
  box-shadow: none;
  color: #fff;
}

.header__brand {
  min-height: auto;
  padding: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.header__link {
  min-height: auto;
  padding: 0;
  font-size: 14px;
  font-weight: 500;
}

.share-shell {
  width: min(1400px, calc(100% - 32px));
  margin: 28px auto 0;
  display: grid;
  gap: 18px;
}

.share-shell__hero {
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
  gap: 20px;
}

.share-shell__eyebrow {
  color: var(--rc-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.share-shell__hero-copy {
  h1 {
    margin: 12px 0 0;
    font-size: 34px;
    line-height: 1.18;
    color: var(--rc-text);
  }

  p {
    margin: 14px 0 0;
    color: var(--rc-text-soft);
    font-size: 15px;
  }
}

.share-shell__hero-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-self: start;
}

.share-shell__hero-item {
  padding: 18px 16px;
  border: 1px solid var(--rc-border);
  border-radius: 8px;
  background: #fafcff;

  small,
  strong {
    display: block;
  }

  small {
    color: var(--rc-text-muted);
    margin-bottom: 10px;
  }

  strong {
    color: var(--rc-text);
    line-height: 1.45;
  }

  .is-success {
    color: var(--rc-success);
  }
}

.share-shell__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 340px;
  gap: 18px;
  align-items: start;
}

.content-card,
.unlock-card {
  padding: 24px;
}

.content-card__head {
  padding-bottom: 18px;
  border-bottom: 1px solid var(--rc-border);

  h2 {
    margin: 0;
    font-size: 22px;
    color: var(--rc-text);
  }

  p {
    margin: 8px 0 0;
    color: var(--rc-text-soft);
  }
}

.content-card__block {
  margin-top: 20px;
  padding: 22px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.content-card__block--granted {
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.08) 0%, rgba(46, 213, 115, 0.14) 100%);
  border-color: rgba(103, 194, 58, 0.16);
}

.content-card__block--locked {
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.12) 0%, rgba(255, 214, 102, 0.18) 100%);
  border-color: rgba(230, 162, 60, 0.18);
}

.content-card__notice {
  display: flex;
  align-items: flex-start;
  gap: 14px;

  .el-icon {
    margin-top: 2px;
    color: #d48806;
    font-size: 22px;
  }

  strong {
    display: block;
    font-size: 16px;
    color: #ad6800;
  }

  p {
    margin: 8px 0 0;
    color: #8c6d1f;
  }
}

.content-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.content-field {
  display: grid;
  gap: 8px;

  &--full {
    grid-column: 1 / -1;
  }
}

.content-field__label {
  color: var(--rc-text-muted);
  font-size: 13px;
}

.content-field__value {
  color: var(--rc-text);
  line-height: 1.7;
  word-break: break-word;
}

.content-field__value--accent {
  color: orangered;
  font-weight: 700;
  text-decoration: underline;
}

.content-field__value--break,
.content-field__value--text {
  white-space: pre-wrap;
}

.content-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.share-shell__aside {
  display: grid;
  gap: 18px;
}

.unlock-card {
  display: grid;
  gap: 16px;
}

.unlock-card__head {
  h3 {
    margin: 0;
    font-size: 18px;
    color: var(--rc-text);
  }

  span {
    display: block;
    margin-top: 6px;
    color: var(--rc-text-soft);
  }
}

.unlock-card__captcha {
  width: 100%;
}

.unlock-card__hint {
  margin: -4px 0 0;
  color: var(--rc-warning);
  font-size: 13px;
  line-height: 1.6;
}

.unlock-card__success {
  padding: 16px;
  border-radius: 8px;
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.14);

  strong {
    color: var(--rc-primary);
  }

  p {
    margin: 8px 0 0;
    color: var(--rc-text-soft);
    line-height: 1.7;
  }
}

.share-empty {
  padding: 40px 28px;
  text-align: center;

  h2 {
    margin: 0;
    color: var(--rc-text);
  }

  p {
    margin: 12px 0 0;
    color: var(--rc-text-soft);
  }

  .el-button {
    margin-top: 18px;
  }
}

@media (max-width: 1080px) {
  .share-shell__hero,
  .share-shell__grid {
    grid-template-columns: 1fr;
  }

  .share-shell__hero-meta {
    grid-template-columns: 1fr;
  }

  .share-shell__aside {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .header.public-header {
    padding: 12px;
  }

  .public-header__inner {
    gap: 12px;
  }

  .share-shell {
    width: calc(100% - 24px);
    margin-top: 16px;
  }

  .share-shell__hero,
  .content-card,
  .unlock-card {
    padding: 18px;
  }

  .share-shell__hero-copy h1 {
    font-size: 28px;
  }

  .content-fields {
    grid-template-columns: 1fr;
  }

  .header__right {
    gap: 10px;
  }
}
</style>
