import axios, { type AxiosRequestConfig } from 'axios'
import { getToken } from '../utils/auth'
import { doneRequestProgress, startRequestProgress } from '../utils/progress'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(
  (config) => {
    startRequestProgress()
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    doneRequestProgress()
    return Promise.reject(error)
  },
)

api.interceptors.response.use(
  (response) => {
    doneRequestProgress()
    return response.data
  },
  (error) => {
    doneRequestProgress()
    const payload = error.response?.data || error
    if (error.response?.status === 401) {
      localStorage.clear()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(payload)
  },
)

function normalizePayload(payload: object, fileKey = 'file') {
  const shouldUseForm = Object.values(payload).some((value) => value instanceof File || value instanceof Blob)
  if (!shouldUseForm) return payload

  const formData = new FormData()
  Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, String(item)))
      return
    }
    if (key === fileKey && value instanceof File) {
      formData.append(key, value)
      return
    }
    formData.append(key, String(value))
  })
  return formData
}

async function request<T>(config: AxiosRequestConfig, pick?: (data: any) => T): Promise<T> {
  const data = (await api.request(config)) as T
  return pick ? pick(data) : data
}

function resolveAuthHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

function parseDownloadFileName(contentDisposition?: string) {
  if (!contentDisposition) return ''

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]

  const plainMatch = contentDisposition.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim() || ''
}

export interface AuthPayload {
  success?: boolean
  token: string
  username: string
  nickname?: string
  role?: 'user' | 'admin'
}

export interface SendCodePayload {
  success?: boolean
  message?: string
  debugCode?: string
}

export interface ProfileInfo {
  username: string
  nickname: string
  contact?: string
  role?: 'user' | 'admin'
  status?: UserStatus
}

export type UserStatus = 'active' | 'disabled' | 'cancellation_pending' | 'cancelled'

export interface AdminUserRecord {
  id: number
  username: string
  phone?: string
  nickname?: string
  contact?: string
  role: 'user' | 'admin'
  status: UserStatus
  cancellationRequestedAt?: string | null
  cancelledAt?: string | null
  lastLogin?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface AdminUserUpdatePayload {
  username?: string
  phone?: string | null
  nickname?: string
  contact?: string
  role?: 'user' | 'admin'
  status?: UserStatus
}

export interface ShareRecord {
  id: number
  shareCode: string
  fileName: string
  downloadFileName?: string
  uploadedFileName?: string
  fileType: string
  price: number
  downloads: number
  earnings?: number
  fileSize?: number
  note?: string
  createdAt?: string
  updatedAt?: string
  resourceType: 'file' | 'cloud' | 'url' | 'text'
  cloudUrl?: string
  extractionCode?: string
  url?: string
  autoRedirect?: boolean
  content?: string
  userPhone?: string
  isPaid?: boolean
  accessExpireAt?: string | null
  authorizationStatus?: 'free' | 'owner' | 'granted' | 'locked'
}

export interface WalletSummary {
  availableBalance: number
  frozenAmount: number
  withdrawnAmount: number
  totalEarnings: number
  pendingWithdrawalAmount: number
  withdrawalCount: number
  paidWithdrawalCount?: number
}

export interface RedeemCodeRecord {
  id: number
  code: string
  resourceId: number
  resourceName: string
  resourceType: 'file' | 'cloud' | 'url' | 'text'
  shareCode: string
  durationCode: string
  status: 'unused' | 'used' | 'disabled'
  usedContact: string
  usedAt?: string
  batchNo: string
  remark?: string
  accessExpireAt?: string | null
  createdAt?: string
}

export interface RedeemRecordRow {
  id: number
  redeemNo: string
  code: string
  resourceId: number
  shareCode?: string
  resourceName: string
  resourceType: 'file' | 'cloud' | 'url' | 'text'
  contact?: string
  redeemedAt: string
  accessExpireAt: string
  status: 'active' | 'expired' | 'revoked'
}

export interface RedeemResourceOption {
  id: number
  fileName: string
  resourceType: 'file' | 'cloud' | 'url' | 'text'
  shareCode: string
  userPhone: string
}

export interface WithdrawalAccountRecord {
  id: number
  type: 'alipay' | 'bank'
  realName: string
  accountNo: string
  maskedAccount: string
  bankName?: string
  status: string
  displayName: string
  createdAt?: string
}

export interface WithdrawalRecord {
  id: string
  withdrawalNo: string
  time: string
  amount: number
  fee: number
  status: string
  rawStatus: string
  account: string
  accountId: number
  remark?: string
}

export interface UploadPayload {
  file?: File | null
  fileName: string
  price?: number
  note?: string
  resourceType: 'file' | 'cloud' | 'url' | 'text'
  cloudUrl?: string
  extractionCode?: string
  url?: string
  autoRedirect?: boolean
  content?: string
}

export interface MessageThreadRecord {
  id: number
  type: 'support' | 'system' | 'guestbook'
  title: string
  preview: string
  status: 'open' | 'pending' | 'waiting_admin' | 'waiting_user' | 'expired' | 'closed'
  priority: 'low' | 'normal' | 'high'
  unreadCount: number
  lastMessageAt: string
  createdAt?: string
  userPhone?: string
  userNickname?: string
  readOnly?: boolean
  canReply?: boolean
  needsReply?: boolean
  sessionExpired?: boolean
  sessionExpiresAt?: string | null
}

export interface MessageEntryRecord {
  id: number
  role: 'user' | 'admin' | 'system'
  text: string
  type: 'chat' | 'note' | 'notification'
  isRead: boolean
  time: string
  createdAt?: string
}

export interface MessageThreadDetail {
  thread: MessageThreadRecord
  messages: MessageEntryRecord[]
}

export interface ShareQueryParams {
  page?: number
  limit?: number
  keyword?: string
  startDate?: string
  endDate?: string
}

export interface PaginationQueryParams {
  page?: number
  limit?: number
}

export interface DashboardTrendRow {
  date: string
  count: number
}

export interface DashboardDistributionRow {
  resourceType: 'file' | 'cloud' | 'url' | 'text' | string
  count: number
}

export interface DashboardRecentRecord {
  id: number
  shareCode: string
  resourceName: string
  resourceType: 'file' | 'cloud' | 'url' | 'text' | string
  code: string
  redeemedAt: string
  accessExpireAt: string
  status: 'active' | 'expired' | 'revoked'
}

export interface DashboardSummaryResponse {
  summary: {
    resourceCount: number
    unusedCodeCount: number
    usedCodeCount: number
    disabledCodeCount: number
    totalRedeemCount: number
    activeAuthorizationCount: number
    expiredAuthorizationCount: number
  }
  distribution: DashboardDistributionRow[]
  trend: DashboardTrendRow[]
  recentRecords: DashboardRecentRecord[]
}

export interface PaginatedListResponse<T> {
  data: T[]
  total: number
  page?: number
  limit?: number
  totalPages?: number
}

export const authApi = {
  sendCode: (account: string, captchaToken: string) => request<SendCodePayload>({ method: 'POST', url: '/auth/send-code', data: { account, captchaToken } }),
  loginByCode: (account: string, code: string, captchaToken: string) => request<AuthPayload>({ method: 'POST', url: '/auth/login', data: { account, code, captchaToken } }),
  loginByPassword: (username: string, password: string, captchaToken: string) => request<AuthPayload>({ method: 'POST', url: '/auth/login-password', data: { username, password, captchaToken } }),
  register: (username: string, password: string, captchaToken: string) => request<AuthPayload>({ method: 'POST', url: '/auth/register', data: { username, password, captchaToken } }),
  verify: () => request({ method: 'GET', url: '/auth/verify' }),
  updatePassword: (newPassword: string) => request({ method: 'POST', url: '/auth/update-password', data: { newPassword } }),
}

export const profileApi = {
  getProfile: () => request<ProfileInfo>({ method: 'GET', url: '/user/profile' }, (data) => data.data),
  updateProfile: (payload: Partial<ProfileInfo>) => request<ProfileInfo>({ method: 'PUT', url: '/user/profile', data: payload }, (data) => data.data),
  requestCancellation: () => request<ProfileInfo>({ method: 'POST', url: '/user/cancellation-request' }, (data) => data.data),
}

export const adminUsersApi = {
  getUsers: (params?: Record<string, unknown>) => request<PaginatedListResponse<AdminUserRecord>>({ method: 'GET', url: '/admin/users', params }),
  getUser: (id: number) => request<AdminUserRecord>({ method: 'GET', url: `/admin/users/${id}` }, (data) => data.data),
  updateUser: (id: number, payload: AdminUserUpdatePayload) => request<AdminUserRecord>({ method: 'PATCH', url: `/admin/users/${id}`, data: payload }, (data) => data.data),
  resetPassword: (id: number, password: string) => request({ method: 'POST', url: `/admin/users/${id}/reset-password`, data: { password } }),
  deleteUser: (id: number) => request({ method: 'DELETE', url: `/admin/users/${id}` }),
}

export const walletApi = {
  getSummary: () => request<WalletSummary>({ method: 'GET', url: '/wallet/summary' }, (data) => data.data),
}

export const redeemApi = {
  getResources: () => request<RedeemResourceOption[]>({ method: 'GET', url: '/redeem-codes/resources/options' }, (data) => data.data),
  getCodes: (params?: Record<string, unknown>) => request<PaginatedListResponse<RedeemCodeRecord>>({ method: 'GET', url: '/redeem-codes', params }),
  importText: (payload: { resourceId: number; content: string }) => request<{ successCount: number; failedCount: number; batchNo: string }>({ method: 'POST', url: '/redeem-codes/import-text', data: payload }),
  importFile: (payload: { resourceId: number; file: File }) => request<{ successCount: number; failedCount: number; batchNo: string }>({ method: 'POST', url: '/redeem-codes/import-file', data: normalizePayload(payload) }),
  generate: (payload: { resourceId: number; durationCode: string; count: string; remark?: string }) =>
    request<{ successCount: number; failedCount: number; batchNo: string }>({ method: 'POST', url: '/redeem-codes/generate', data: payload }),
  freezeCode: (id: number) => request({ method: 'POST', url: `/redeem-codes/${id}/freeze` }),
  unfreezeCode: (id: number) => request({ method: 'POST', url: `/redeem-codes/${id}/unfreeze` }),
  disableCode: (id: number) => request({ method: 'POST', url: `/redeem-codes/${id}/disable` }),
  deleteCode: (id: number) => request({ method: 'DELETE', url: `/redeem-codes/${id}` }),
  getRecords: (params?: Record<string, unknown>) => request<PaginatedListResponse<RedeemRecordRow>>({ method: 'GET', url: '/redeem-records', params }),
  redeem: (payload: { code: string; shareCode?: string; captchaToken?: string }) => request<{ data: { redeemNo: string; redeemedAt: string; accessExpireAt: string; accessToken: string; resource: ShareRecord | null } }>({ method: 'POST', url: '/redeem', data: payload }),
}

export const withdrawalApi = {
  getAccounts: () => request<{ data: WithdrawalAccountRecord[]; total: number }>({ method: 'GET', url: '/withdrawal-accounts' }),
  createAccount: (payload: { type: 'alipay' | 'bank'; realName: string; accountNo: string; bankName?: string }) =>
    request<{ data: WithdrawalAccountRecord }>({ method: 'POST', url: '/withdrawal-accounts', data: payload }),
  deleteAccount: (id: number) => request({ method: 'DELETE', url: `/withdrawal-accounts/${id}` }),
  getWithdrawals: (params?: PaginationQueryParams) => request<PaginatedListResponse<WithdrawalRecord>>({ method: 'GET', url: '/withdrawals', params }),
  createWithdrawal: (payload: { accountId: number; amount: number }) =>
    request<{ data: WithdrawalRecord; message: string }>({ method: 'POST', url: '/withdrawals', data: payload }),
}

export const shareApi = {
  getDashboardSummary: () => request<DashboardSummaryResponse>({ method: 'GET', url: '/dashboard-summary' }, (data) => data.data),
  upload: (payload: UploadPayload) => request<{ shareCode: string; message: string }>({
    method: 'POST',
    url: '/upload',
    data: normalizePayload(payload),
  }),
  getShare: (code: string, accessToken?: string) => request<ShareRecord>({ method: 'GET', url: `/share/${code}`, params: accessToken ? { accessToken } : undefined }, (data) => data.data),
  getMyShares: (pageOrParams: number | ShareQueryParams = 1, limit = 50) => request<PaginatedListResponse<ShareRecord>>({
    method: 'GET',
    url: '/my-shares',
    params:
      typeof pageOrParams === 'object'
        ? {
          page: pageOrParams.page || 1,
          limit: pageOrParams.limit || 50,
          keyword: pageOrParams.keyword || '',
          startDate: pageOrParams.startDate || '',
          endDate: pageOrParams.endDate || '',
        }
        : { page: pageOrParams, limit },
  }),
  updateShare: (code: string, payload: Partial<UploadPayload> & { fileType?: string }) => request<{ data: ShareRecord }>({
    method: 'PUT',
    url: `/share/${code}`,
    data: normalizePayload(payload),
  }),
  deleteShare: (code: string) => request({ method: 'DELETE', url: `/share/${code}` }),
  download: async (code: string, payload?: { accessToken?: string }) => {
    const response = await axios.get(`/api/download/${code}`, {
      params: payload,
      responseType: 'blob',
      headers: resolveAuthHeaders(),
    })

    return {
      blob: response.data as Blob,
      fileName: parseDownloadFileName(response.headers['content-disposition']),
    }
  },
}

export const messagesApi = {
  getSummary: () => request<{ unreadCount: number; pendingCount: number }>({ method: 'GET', url: '/messages/unread-summary' }, (data) => data.data),
  getThreads: (type = 'all') => request<MessageThreadRecord[]>({ method: 'GET', url: '/messages/threads', params: { type } }, (data) => data.data),
  ensureSupportSession: () => request<MessageThreadRecord>({ method: 'POST', url: '/messages/support/session' }, (data) => data.data),
  getThreadDetail: (id: number) => request<MessageThreadDetail>({ method: 'GET', url: `/messages/threads/${id}` }, (data) => data.data),
  sendMessage: (id: number, payload: { content: string; messageType?: 'chat' | 'note' }) =>
    request<MessageEntryRecord>({ method: 'POST', url: `/messages/threads/${id}/messages`, data: payload }, (data) => data.data),
}

export default api
