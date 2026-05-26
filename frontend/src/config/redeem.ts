export interface RedeemDurationOption {
  label: string
  value: string
}

export const redeemDurationOptions: RedeemDurationOption[] = [
  { label: '1 小时', value: '1h' },
  { label: '3 小时', value: '3h' },
  { label: '6 小时', value: '6h' },
  { label: '12 小时', value: '12h' },
  { label: '1 天', value: '1d' },
  { label: '3 天', value: '3d' },
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
]

export const redeemDurationValueText = redeemDurationOptions.reduce<Record<string, string>>((result, item) => {
  result[item.value] = item.label
  return result
}, {})

export function formatRedeemDuration(durationCode?: string | null) {
  const normalized = String(durationCode || '').trim()
  return redeemDurationValueText[normalized] || normalized || '--'
}
