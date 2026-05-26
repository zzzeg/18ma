export function formatDate(dateInput: Date | string | number | null | undefined, format = 'yyyy-MM-dd hh:mm:ss'): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') return ''

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (Number.isNaN(date.getTime())) {
    return String(dateInput)
  }

  const map: Record<string, number> = {
    'M+': date.getMonth() + 1,
    'd+': date.getDate(),
    'h+': date.getHours(),
    'm+': date.getMinutes(),
    's+': date.getSeconds(),
    'q+': Math.floor((date.getMonth() + 3) / 3),
    S: date.getMilliseconds(),
  }

  let formatted = format.replace(/y+/g, (match) => date.getFullYear().toString().slice(-match.length))

  Object.keys(map).forEach((key) => {
    formatted = formatted.replace(new RegExp(key, 'g'), (match) => {
      const value = map[key].toString()
      return match.length === 1 ? value : value.padStart(match.length, '0')
    })
  })

  return formatted
}

export function formatRelativeDate(dateInput: Date | string | number | null | undefined): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput || '')
  if (Number.isNaN(date.getTime())) return '--'

  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return formatDate(date, 'yyyy-MM-dd')
}

export function formatFileSize(bytes: number | null | undefined): string {
  const value = Number(bytes || 0)
  if (value <= 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

export function formatCurrency(amount: number | string | null | undefined, digits = 2): string {
  const value = Number(amount || 0)
  return `¥ ${value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatNumber(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString('zh-CN')
}

export function generateShareLink(code?: string): string {
  const normalized = String(code || '').trim()
  return normalized
    ? `${window.location.origin}/share/${encodeURIComponent(normalized)}`
    : `${window.location.origin}/share`
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export function downloadBlobFile(blob: Blob, fileName: string): void {
  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(objectUrl)
}

export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateUsername(username: string): boolean {
  return /^[A-Za-z0-9_]{4,20}$/.test(username.trim())
}

export function validatePassword(password: string): boolean {
  return password.length >= 6
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getFileIconByType(typeValue?: string): string {
  switch (typeValue) {
    case '网盘':
      return '☁'
    case '链接':
      return '↗'
    case '文本':
    case '文本信息':
      return 'T'
    case '文件':
    default:
      return 'F'
  }
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '--'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function initials(input?: string | null): string {
  const safe = (input || 'RC').trim()
  return safe.slice(0, 2).toUpperCase()
}
