<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '../api/services'
import TurnstileWidget from '../components/TurnstileWidget.vue'
import { useAppStore } from '../stores/app'
import { validatePassword, validateUsername } from '../utils/utils'

const router = useRouter()
const store = useAppStore()
const loading = ref(false)
const captchaToken = ref('')
const captchaRef = ref<InstanceType<typeof TurnstileWidget> | null>(null)
const form = ref({ username: '', password: '', confirmPassword: '' })

function resetCaptcha() {
  captchaToken.value = ''
  captchaRef.value?.reset()
}

async function submit() {
  if (!validateUsername(form.value.username)) {
    ElMessage.warning('用户名需为 4-20 位字母、数字或下划线')
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
    const result = await authApi.register(form.value.username.trim(), form.value.password, captchaToken.value)
    store.login(result.token, result.username, result.nickname, result.role || 'user')
    ElMessage.success('注册成功')
    router.push('/dashboard')
  } catch (error: any) {
    ElMessage.error(error.error || '注册失败')
  } finally {
    loading.value = false
    resetCaptcha()
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell panel">
      <div class="auth-shell__copy auth-shell__copy--light">
        <span>RegCode Admin</span>
        <h1>创建分享者账户</h1>
        <p>创建用户名账号后即可进入后台，管理资源、卡密与交付记录。</p>
      </div>
      <div class="auth-shell__form">
        <el-input v-model="form.username" placeholder="用户名（4-20 位字母、数字或下划线）" />
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
