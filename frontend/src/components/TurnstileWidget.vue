<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type TurnstileTheme = 'light' | 'dark' | 'auto'
type TurnstileSize = 'normal' | 'compact' | 'flexible'

const props = withDefaults(defineProps<{
  modelValue?: string
  action?: string
  theme?: TurnstileTheme
  size?: TurnstileSize
}>(), {
  modelValue: '',
  action: 'default',
  theme: 'auto',
  size: 'flexible',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'success', value: string): void
  (e: 'expired'): void
  (e: 'error', value: string): void
}>()

const TEST_SITE_KEY = '1x00000000000000000000AA'
const siteKey = computed(() => {
  const configured = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim()
  if (configured) return configured
  return import.meta.env.DEV ? TEST_SITE_KEY : ''
})

const enabled = computed(() => Boolean(siteKey.value))
const loading = ref(false)
const errorText = ref('')
const containerRef = ref<HTMLDivElement | null>(null)
let widgetId: string | number | null = null

function getScriptPromise() {
  if (window.turnstile) return Promise.resolve()
  if (window.__turnstileScriptPromise) return window.__turnstileScriptPromise

  window.__turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.turnstileScript = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script load failed'))
    document.head.appendChild(script)
  })

  return window.__turnstileScriptPromise
}

function clearToken() {
  emit('update:modelValue', '')
}

function reset() {
  clearToken()
  errorText.value = ''
  if (widgetId !== null && window.turnstile?.reset) {
    window.turnstile.reset(widgetId)
  }
}

async function renderWidget() {
  if (!enabled.value || !containerRef.value) {
    errorText.value = enabled.value ? '' : '未配置 Turnstile Site Key'
    return
  }

  loading.value = true
  errorText.value = ''

  try {
    await getScriptPromise()
    await nextTick()

    if (!containerRef.value || !window.turnstile) {
      throw new Error('Turnstile unavailable')
    }

    if (widgetId !== null && window.turnstile.remove) {
      window.turnstile.remove(widgetId)
      widgetId = null
    }

    containerRef.value.innerHTML = ''
    widgetId = window.turnstile.render(containerRef.value, {
      sitekey: siteKey.value,
      action: props.action,
      theme: props.theme,
      size: props.size,
      callback(token: string) {
        errorText.value = ''
        emit('update:modelValue', token)
        emit('success', token)
      },
      'expired-callback': () => {
        clearToken()
        emit('expired')
      },
      'error-callback': (code: string) => {
        clearToken()
        errorText.value = '人机验证加载失败，请稍后重试'
        emit('error', code)
      },
    })
  } catch (error) {
    console.error('Turnstile widget render error:', error)
    clearToken()
    errorText.value = '人机验证初始化失败，请刷新页面后重试'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.action, props.theme, props.size].join(':'),
  () => {
    void renderWidget()
  },
)

onMounted(() => {
  void renderWidget()
})

onBeforeUnmount(() => {
  clearToken()
  if (widgetId !== null && window.turnstile?.remove) {
    window.turnstile.remove(widgetId)
    widgetId = null
  }
})

defineExpose({
  enabled,
  reset,
  renderWidget,
})
</script>

<template>
  <div class="turnstile-widget">
    <div ref="containerRef" class="turnstile-widget__container" :class="{ 'is-loading': loading }" />
    <p v-if="errorText" class="turnstile-widget__error">{{ errorText }}</p>
  </div>
</template>

<style scoped lang="scss">
.turnstile-widget {
  display: grid;
  gap: 8px;

  &__container {
    min-height: 66px;
  }

  &__error {
    margin: 0;
    color: var(--rc-danger);
    font-size: 12px;
    line-height: 1.5;
  }
}
</style>
