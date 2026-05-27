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
const form = ref({ username: '', password: '' })

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
  if (!captchaToken.value) {
    ElMessage.warning('请先完成人机验证')
    return
  }

  loading.value = true
  try {
    const result = await authApi.loginByPassword(form.value.username.trim(), form.value.password, captchaToken.value)
    store.login(result.token, result.username, result.nickname, result.role || 'user')
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
        <el-input v-model="form.username" placeholder="用户名" />
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  background:
    linear-gradient(90deg, rgba(17, 24, 39, 0.05) 1px, transparent 1px),
    linear-gradient(180deg, rgba(17, 24, 39, 0.05) 1px, transparent 1px),
    #f7f8fa;
  background-size: 72px 72px;
  border-top: 4px solid #089b8f;
}

.auth-shell {
  width: min(1100px, 100%);
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) 440px;
  gap: 32px;
  align-items: center;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;

  &__copy,
  &__form {
    min-width: 0;
  }

  &__copy {
    color: #111827;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 28px 0;

    span {
      width: fit-content;
      min-height: 62px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 18px;
      color: #009684;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      background: rgba(255, 255, 255, 0.82);
      border: 1px solid rgba(226, 232, 240, 0.9);
      border-radius: 16px;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.06);
    }

    span::before {
      content: 'R';
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 22px;
      font-weight: 800;
      background: linear-gradient(135deg, #0f766e, #14b8a6);
      box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.32);
    }

    h1 {
      margin: 42px 0 0;
      font-size: clamp(42px, 4.5vw, 56px);
      line-height: 1.06;
      letter-spacing: 0;
      font-weight: 800;
    }

    p {
      max-width: 620px;
      margin: 18px 0 0;
      color: #334155;
      font-size: 16px;
      line-height: 1.9;
    }
  }

  &__form {
    display: grid;
    gap: 14px;
    align-content: center;
    padding: 32px;
    background: #fff;
    border: 1px solid #d7eeeb;
    border-radius: 12px;
    box-shadow: 0 26px 64px rgba(15, 23, 42, 0.12);

    &::before {
      content: '欢迎登录';
      color: #111827;
      font-size: 28px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 10px;
    }
    
    :deep(.el-input__wrapper) {
      min-height: 38px;
      border-radius: 7px;
      background: #eaf2ff;
      box-shadow: inset 0 0 0 1px #d8e4f5;
    }

    :deep(.el-input__wrapper.is-focus) {
      box-shadow: inset 0 0 0 1px #0f9f8f;
    }

    :deep(.el-input__inner) {
      color: #111827;
      font-size: 14px;
    }

    :deep(.el-button) {
      min-height: 36px;
      border: 0;
      border-radius: 7px;
      background: #11998b;
      font-size: 14px;
      font-weight: 600;
      box-shadow: none;
    }

    :deep(.el-button:hover),
    :deep(.el-button:focus) {
      background: #0b8277;
    }
  }
}

.foot-link {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;

  span {
    color: #089b8f;
    font-weight: 700;
    cursor: pointer;
  }
}

:deep(.turnstile-widget__container) {
  min-height: 70px;
}

@media (max-width: 900px) {
  .auth-page {
    align-items: flex-start;
  }

  .auth-shell {
    grid-template-columns: 1fr;
    gap: 20px;

    &__form {
      padding: 28px 22px;
    }

    &__copy {
      padding: 10px 0 0;

      h1 {
        margin-top: 24px;
      }
    }
  }
}
</style>
