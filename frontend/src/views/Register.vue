<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '../api/services'
import TurnstileWidget from '../components/TurnstileWidget.vue'
import { useAppStore } from '../stores/app'
import { validateEmail, validatePassword } from '../utils/utils'

const router = useRouter()
const store = useAppStore()
const sending = ref(false)
const loading = ref(false)
const sendCooldown = ref(0)
const captchaToken = ref('')
const captchaRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const form = ref({ email: '', code: '', password: '', confirmPassword: '' })
let cooldownTimer: number | null = null

function resetCaptcha() {
  captchaToken.value = ''
  captchaRef.value?.reset()
}

function startCooldown(seconds = 60) {
  if (cooldownTimer !== null) {
    window.clearInterval(cooldownTimer)
  }
  sendCooldown.value = seconds
  cooldownTimer = window.setInterval(() => {
    if (sendCooldown.value <= 1) {
      sendCooldown.value = 0
      if (cooldownTimer !== null) {
        window.clearInterval(cooldownTimer)
        cooldownTimer = null
      }
      return
    }
    sendCooldown.value -= 1
  }, 1000)
}

async function sendCode() {
  if (!validateEmail(form.value.email)) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }
  if (!captchaToken.value) {
    ElMessage.warning('请先完成人机验证')
    return
  }
  if (sendCooldown.value > 0) {
    ElMessage.warning(`请 ${sendCooldown.value} 秒后再试`)
    return
  }
  sending.value = true
  try {
    const result = await authApi.sendCode(form.value.email.trim(), captchaToken.value)
    startCooldown(60)
    ElMessage.success(result.debugCode ? `验证码已发送，开发环境验证码：${result.debugCode}` : '验证码已发送，请前往邮箱查收')
  } catch (error: any) {
    ElMessage.error(error.error || '发送失败')
  } finally {
    sending.value = false
    resetCaptcha()
  }
}

async function submit() {
  if (!validateEmail(form.value.email)) {
    ElMessage.warning('请输入正确的邮箱地址')
    return
  }
  if (!form.value.code.trim()) {
    ElMessage.warning('请输入邮箱验证码')
    return
  }
  if (!validatePassword(form.value.password)) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (form.value.password !== form.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  if (!captchaToken.value) {
    ElMessage.warning('请先完成人机验证')
    return
  }

  loading.value = true
  try {
    const result = await authApi.register(form.value.email.trim(), form.value.code.trim(), form.value.password, captchaToken.value)
    store.login(result.token, result.phone, result.nickname, result.role || 'user')
    ElMessage.success('注册成功')
    router.push('/dashboard')
  } catch (error: any) {
    ElMessage.error(error.error || '注册失败')
  } finally {
    loading.value = false
    resetCaptcha()
  }
}

onBeforeUnmount(() => {
  if (cooldownTimer !== null) {
    window.clearInterval(cooldownTimer)
  }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell panel">
      <div class="auth-shell__copy auth-shell__copy--light">
        <span>RegCode Admin</span>
        <h1>创建分享者账户</h1>
        <p>完成邮箱验证后即可进入后台，管理资源、卡密与交付记录。</p>
      </div>
      <div class="auth-shell__form">
        <el-input v-model="form.email" placeholder="邮箱地址" />
        <div class="code-row">
          <el-input v-model="form.code" placeholder="邮箱验证码" />
          <el-button plain :loading="sending" :disabled="sendCooldown > 0" @click="sendCode">
            {{ sendCooldown > 0 ? `${sendCooldown}s` : '获取验证码' }}
          </el-button>
        </div>
        <el-input v-model="form.password" type="password" placeholder="设置密码" show-password />
        <el-input v-model="form.confirmPassword" type="password" placeholder="重复密码" show-password />
        <TurnstileWidget ref="captchaRef" v-model="captchaToken" action="register" />
        <el-button type="primary" :loading="loading" @click="submit">注册并进入系统</el-button>
        <div class="foot-link">已有账号？<span @click="router.push('/login')">去登录</span></div>
        <div class="foot-link">游客输入卡密提取资源？<span @click="router.push('/index')">去提取</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 14% 18%, rgba(64, 158, 255, 0.12), transparent 18%),
    radial-gradient(circle at 84% 14%, rgba(64, 158, 255, 0.08), transparent 16%),
    #f0f2f5;
}

.auth-shell {
  width: min(1020px, 100%);
  display: grid;
  grid-template-columns: 1fr 0.9fr;
  overflow: hidden;
  border: 1px solid var(--rc-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 21, 41, 0.08);

  &__copy,
  &__form {
    padding: 40px 36px;
  }

  &__copy {
    background:
      linear-gradient(135deg, rgba(64, 158, 255, 0.96), rgba(56, 139, 253, 0.9)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;

    span {
      color: rgba(255, 255, 255, 0.76);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 18px 0 0;
      font-size: clamp(36px, 4vw, 48px);
      line-height: 1.08;
      letter-spacing: -0.03em;
      font-weight: 600;
    }

    p {
      margin-top: 18px;
      color: rgba(255, 255, 255, 0.82);
      font-size: 15px;
      line-height: 1.8;
    }
  }

  &__form {
    display: grid;
    gap: 16px;
    align-content: center;

    &::before {
      content: '创建账号';
      color: var(--rc-text);
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
    }

    :deep(.el-input__wrapper) {
      min-height: 40px;
    }

    :deep(.el-input__inner) {
      font-size: 15px;
    }

    :deep(.el-button) {
      min-height: 40px;
      font-size: 15px;
      font-weight: 600;
    }
  }
}

.code-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
}

.foot-link {
  color: var(--rc-text-soft);
  font-size: 14px;
  line-height: 1.8;

  span {
    color: var(--rc-primary);
    font-weight: 600;
    cursor: pointer;
  }
}

:deep(.turnstile-widget__container) {
  min-height: 70px;
}

@media (max-width: 900px) {
  .auth-shell {
    grid-template-columns: 1fr;

    &__copy,
    &__form {
      padding: 32px 24px;
    }
  }
}
</style>
