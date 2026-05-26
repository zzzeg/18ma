import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getNickName, getPhone, getRole, getToken, removeNickName, removePhone, removeRole, removeToken, setNickName, setPhone, setRole, setToken } from '../utils/auth'
import { pinia } from './pinia'

export interface AppUser {
  phone: string
  nickname: string
  contact?: string
  balance: number
  role: 'user' | 'admin'
}

const useAppStoreBase = defineStore('app', () => {
  const token = ref<string | null>(getToken())
  const phone = ref<string | null>(getPhone())
  const nickname = ref<string>(getNickName() || '未命名用户')
  const role = ref<'user' | 'admin'>((getRole() as 'user' | 'admin') || 'user')
  const contact = ref('')
  const balance = ref(0)
  const unreadCount = ref(0)
  const sidebarCollapsed = ref(false)
  const mobileSidebarOpen = ref(false)

  const isAuthenticated = computed(() => Boolean(token.value && phone.value))
  const user = computed<AppUser | null>(() => {
    if (!phone.value) return null
    return {
      phone: phone.value,
      nickname: nickname.value || '未命名用户',
      contact: contact.value,
      balance: balance.value,
      role: role.value,
    }
  })

  function login(nextToken: string, nextPhone: string, nextNickname?: string, nextRole: 'user' | 'admin' = 'user') {
    token.value = nextToken
    phone.value = nextPhone
    nickname.value = nextNickname || nickname.value || '未命名用户'
    role.value = nextRole
    setToken(nextToken)
    setPhone(nextPhone)
    setNickName(nickname.value)
    setRole(nextRole)
  }

  function logout() {
    token.value = null
    phone.value = null
    nickname.value = '未命名用户'
    role.value = 'user'
    contact.value = ''
    unreadCount.value = 0
    removeToken()
    removePhone()
    removeNickName()
    removeRole()
  }

  function applyProfile(profile: { phone: string; nickname?: string; contact?: string; role?: 'user' | 'admin' }) {
    phone.value = profile.phone
    nickname.value = profile.nickname || nickname.value || '未命名用户'
    contact.value = profile.contact || ''
    role.value = profile.role || role.value || 'user'
    setPhone(profile.phone)
    setNickName(nickname.value)
    setRole(role.value)
  }

  function updateBalance(nextBalance: number) {
    balance.value = nextBalance
  }

  function setUnreadCount(count: number) {
    unreadCount.value = count
  }

  function toggleSidebar(force?: boolean) {
    sidebarCollapsed.value = typeof force === 'boolean' ? force : !sidebarCollapsed.value
  }

  function toggleMobileSidebar(force?: boolean) {
    mobileSidebarOpen.value = typeof force === 'boolean' ? force : !mobileSidebarOpen.value
  }

  return {
    token,
    phone,
    nickname,
    role,
    contact,
    balance,
    unreadCount,
    sidebarCollapsed,
    mobileSidebarOpen,
    isAuthenticated,
    user,
    login,
    logout,
    applyProfile,
    updateBalance,
    setUnreadCount,
    toggleSidebar,
    toggleMobileSidebar,
  }
})

export function useAppStore() {
  return useAppStoreBase(pinia)
}
