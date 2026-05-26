<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '../api/services'
import TurnstileWidget from '../components/TurnstileWidget.vue'
import { useAppStore } from '../stores/app'
import { validateEmail, validatePassword, validatePhone } from '../utils/utils'

const router = useRouter()
const store = useAppStore()
const loading = ref(false)
const captchaToken = ref('')
const captchaRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const form = ref({ account: '', password: '' })

function resetCaptcha() {
  captchaToken.value = ''
  captchaRef.value?.reset()
}

function validateAccountInput(value: string) {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.includes('@')) return validateEmail(normalized)
  return validatePhone(normalized)
}

async function submit() {
  if (!validateAccountInput(form.value.account)) {
    ElMessage.warning('请输入正确的邮箱或手机号')
    return
  }

  if (!validatePassword(form.value.password)) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (!captchaToken.value) {
    ElMessage.warning('请先完成人机验证')
    return
  }

  loading.value = true
  try {
    const result = await authApi.loginByPassword(form.value.account.trim(), form.value.password, captchaToken.value)
    store.login(result.token, result.phone, result.nickname, result.role || 'user')
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (error: any) {
    ElMessage.error(error.error || '登录失败')
  } finally {
    loading.value = false
    resetCaptcha()
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell panel">
      <div class="auth-shell__copy">
        <span>RegCode Admin</span>
        <h1>构建标准，定义卓越</h1>
        <p>登录后进入资源管理、卡密管理、订单查询与交付控制台。</p>
      </div>
      <div class="auth-shell__form">
        <el-input v-model="form.account" placeholder="邮箱 / 手机号" />
        <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        <TurnstileWidget ref="captchaRef" v-model="captchaToken" action="login" />
        <el-button type="primary" :loading="loading" @click="submit">登录</el-button>
        <div class="foot-link">没有账号？<span @click="router.push('/register')">立即注册</span></div>
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
    radial-gradient(circle at 18% 18%, rgba(64, 158, 255, 0.12), transparent 18%),
    radial-gradient(circle at 82% 12%, rgba(64, 158, 255, 0.08), transparent 16%),
    #f0f2f5;
}

.auth-shell {
  width: min(1040px, 100%);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  overflow: hidden;
  border: 1px solid var(--rc-border);
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 21, 41, 0.08);

  &__copy,
  &__form {
    padding: 44px 40px;
  }

  &__copy {
    position: relative;
    background:
      linear-gradient(135deg, rgba(64, 158, 255, 0.98), rgba(56, 139, 253, 0.92)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
    color: #fff;
    display: flex;
    flex-direction: column;
    justify-content: center;
    isolation: isolate;

    span {
      color: rgba(255, 255, 255, 0.76);
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 18px 0 0;
      font-size: clamp(40px, 4vw, 52px);
      line-height: 1.08;
      letter-spacing: -0.03em;
      font-weight: 600;
    }

    p {
      max-width: 440px;
      margin-top: 18px;
      color: rgba(255, 255, 255, 0.82);
      font-size: 15px;
      line-height: 1.9;
    }
  }

  &__form {
    display: grid;
    gap: 16px;
    align-content: center;
    background: #fff;

    &::before {
      content: '欢迎登录';
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

.foot-link {
  color: var(--rc-text-soft);
  font-size: 14px;
  line-height: 1.8;

  span {
    color: var(--rc-primary);
    font-weight: 700;
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
