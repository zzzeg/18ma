interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: (errorCode: string) => void
}

interface TurnstileApi {
  render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string | number
  reset: (widgetId?: string | number) => void
  remove: (widgetId?: string | number) => void
  getResponse: (widgetId?: string | number) => string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __turnstileScriptPromise?: Promise<void>
  }
}

export {}
