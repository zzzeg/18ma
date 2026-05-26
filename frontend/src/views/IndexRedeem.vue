<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import TurnstileWidget from '../components/TurnstileWidget.vue'
import { redeemApi, shareApi, type ShareRecord } from '../api/services'
import { useAppStore } from '../stores/app'
import { copyToClipboard, formatFileSize } from '../utils/utils'

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
const lastResolvedRedeemCode = ref('')
let expireTimer: number | null = null

const isAuthenticated = computed(() => store.isAuthenticated)
const isLegacyShareRoute = computed(() => route.name === 'share')
const routeCode = computed(() => String(route.params.code || '').trim())
const normalizedRouteCode = computed(() => routeCode.value.toUpperCase())
const activeShareCode = computed(() => String(share.value?.shareCode || (isLegacyShareRoute.value ? routeCode.value : '')).trim())
const isFree = computed(() => Number(share.value?.price || 0) <= 0)
const canAccess = computed(() => Boolean(share.value?.isPaid || isFree.value))
const deliveryFileName = computed(() => share.value?.uploadedFileName || '--')
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

async function loadShare(shareCode = activeShareCode.value) {
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
    if (isLegacyShareRoute.value && routeCode.value) {
      clearAccessToken(shareCode)
      ElMessage.error(error.error || '资源不存在或已下架')
      void router.replace('/index')
    } else {
      ElMessage.error(error.error || '资源加载失败')
    }
  } finally {
    loading.value = false
  }
}

async function submitRedeem(options: {
  presetCode?: string
  syncRoute?: boolean
  silentSuccess?: boolean
  silentError?: boolean
} = {}) {
  const normalizedCode = String(options.presetCode ?? redeemCode.value).trim().toUpperCase()
  if (!normalizedCode) {
    if (!options.silentError) ElMessage.warning('请输入卡密')
    return false
  }
  if (captchaRequired.value && !captchaToken.value) {
    if (!options.silentError) ElMessage.warning('请先完成人机验证')
    return false
  }

  submitting.value = true
  try {
    const result = await redeemApi.redeem({
      code: normalizedCode,
      captchaToken: captchaToken.value || undefined,
      shareCode: isLegacyShareRoute.value ? (routeCode.value || share.value?.shareCode || undefined) : undefined,
    })
    const resolvedShareCode = result.data.resource?.shareCode
    if (!resolvedShareCode) {
      throw new Error('卡密已解析，但资源信息缺失')
    }

    saveAccessToken(resolvedShareCode, result.data.accessToken)
    lastResolvedRedeemCode.value = normalizedCode
    redeemCode.value = normalizedCode
    captchaRequired.value = false

    if (!isLegacyShareRoute.value && (options.syncRoute ?? true) && normalizedRouteCode.value !== normalizedCode) {
      await router.replace({ name: 'index', params: { code: normalizedCode } })
    }

    await loadShare(resolvedShareCode)

    if (!options.silentSuccess) {
      ElMessage.success(isLegacyShareRoute.value ? '卡密验证成功，当前资源已授权' : '卡密验证成功，已为你解锁对应资源')
    }
    return true
  } catch (error: any) {
    if (error?.requiresCaptcha || error?.code === 'REDEEM_CAPTCHA_REQUIRED') {
      captchaRequired.value = true
      if (!options.silentError) {
        ElMessage.warning(error.error || '操作较频繁，请先完成人机验证后重试')
      }
      return false
    }
    if (!options.silentError) {
      ElMessage.error(error.error || error.message || '兑换失败')
    }
    if (!isLegacyShareRoute.value) {
      share.value = null
    }
    return false
  } finally {
    submitting.value = false
    resetCaptcha()
  }
}

async function bootstrapRoute() {
  clearExpireTimer()
  captchaRequired.value = false

  if (isLegacyShareRoute.value) {
    redeemCode.value = ''
    lastResolvedRedeemCode.value = ''
    if (!routeCode.value) {
      share.value = null
      return
    }
    await loadShare(routeCode.value)
    return
  }

  if (!routeCode.value) {
    share.value = null
    redeemCode.value = ''
    lastResolvedRedeemCode.value = ''
    return
  }

  const normalizedCode = normalizedRouteCode.value
  redeemCode.value = normalizedCode
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
  [isLegacyShareRoute, routeCode],
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
  <div class="guest-query-page">
    <header class="header glass-panel public-header">
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
    </header>

    <section class="panel guest-query-shell" v-loading="loading">
      <div class="guest-query-shell__copy">
        <span>{{ isLegacyShareRoute ? '资源提取' : '访客查询' }}</span>
        <h1 style="text-align: center;">{{ isLegacyShareRoute ? '输入卡密提取资源' : '按卡密查询/提取资源' }}</h1>
      </div>

      <div class="guest-query-shell__search" style="display: flex; align-items: center;">
        <el-input v-model="redeemCode" maxlength="64" placeholder="请输入卡密" style="height: 3rem;"
          @keyup.enter="submitRedeem()" />
        <el-button type="primary" size="large" :loading="submitting" @click="submitRedeem()">查询</el-button>
      </div>
      <p v-if="captchaRequired" class="guest-query-shell__hint">当前验证请求较频繁，请先完成人机验证。</p>
      <TurnstileWidget
        v-if="!canAccess && captchaRequired"
        ref="captchaRef"
        v-model="captchaToken"
        action="redeem"
        class="guest-query-shell__captcha"
      />

      <div v-if="share && canAccess" class="guest-query-shell__list">
        <article class="result-card">
          <div class="result-card__row">
            <strong>{{ share.fileName }}</strong>
            <span>{{ resourceTypeText(share.resourceType) }}</span>
          </div>

          <template v-if="share.resourceType === 'cloud'">
            <p>网盘链接：{{ share.cloudUrl }}</p>
            <p>提取码：{{ share.extractionCode || '无' }}</p>
            <p>备&nbsp;&nbsp;注：{{ share.note?.trim() || '——' }}</p>
          </template>

          <template v-else-if="share.resourceType === 'url'">
            <p>跳转链接：{{ share.url }}</p>
            <p>{{ share.autoRedirect ? '已启用自动跳转' : '未启用自动跳转' }}</p>
            <p>备注：{{ share.note?.trim() || '——' }}</p>
          </template>

          <template v-else-if="share.resourceType === 'text'">
            <p>已解锁内容：{{ share.content }}</p>
            <p>备注：{{ share.note?.trim() || '——' }}</p>
          </template>

          <div v-else class="result-card__file-actions">
            <p>
              <span>文件：</span>
              <span class="result-card__filename">{{ deliveryFileName }}</span>
            </p>
            <p>大小：{{ formatFileSize(share.fileSize) }}</p>
            <p>备注：{{ share.note?.trim() || '——' }}</p>
            <div class="content-card__actions">
              <el-button type="success" :loading="downloading" @click="downloadFile">下载文件</el-button>
              <el-button v-if="dynamicDownloadLink" plain @click="copyDownloadLink">复制下载链接</el-button>
            </div>
            <div v-if="dynamicDownloadLink" class="download-link-card">
              <span class="download-link-card__label">下载链接</span>
              <code>{{ dynamicDownloadLink }}</code>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.guest-query-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0px;
}

.header.public-header {
  position: sticky;
  top: 0;
  z-index: 30;
  width: 100%;
  margin: 0 0 18px;
  padding: 12px 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  border: 1px solid var(--rc-border);
  background: var(--rc-primary);
  box-shadow: var(--rc-shadow-soft);
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
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--rc-primary);
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
  min-height: 34px;
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

.guest-query-shell {
  width: min(980px, 100%);
  padding: 28px;
  display: grid;
  gap: 20px;
  margin-top: 60px;

  &__copy {
    span {
      color: var(--rc-primary);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 14px 0 0;
      font-size: 2.4rem;
      line-height: 1.06;
      letter-spacing: -0.05em;
    }
  }

  &__search {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
  }

  &__captcha {
    width: 100%;
    max-width: 520px;
    margin: 0 auto 12px;
  }

  &__hint {
    margin: -6px auto 0;
    color: var(--rc-warning);
    font-size: 13px;
    line-height: 1.6;
  }

  &__list {
    display: grid;
    gap: 14px;
  }
}

.result-card {
  padding: 18px;
  border-radius: 18px;
  background: #f8fbff;
  color: var(--rc-text-soft);

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  p {
    margin: 10px 0 0;
  }

  &__filename {
    color: orangered;
    font-weight: 700;
    text-decoration: underline;
  }
}

.content-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}

.result-card__file-actions {
  margin-top: 10px;
}

.download-link-card {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 0 0 1px rgba(23, 91, 70, 0.08);

  &__label {
    margin-bottom: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  code {
    display: block;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.66);
    color: #175b46;
    font-family: Consolas, monospace;
    word-break: break-all;
    white-space: pre-wrap;
  }
}

@media (max-width: 720px) {
  .guest-query-page {
    padding: 12px 12px 24px;
  }

  .header.public-header {
    margin-bottom: 12px;
    padding: 12px 14px;
  }

  .header__brand,
  .header__link {
    min-height: 38px;
    padding: 0 14px;
  }

  .guest-query-shell__search {
    grid-template-columns: 1fr;
  }
}
</style>
