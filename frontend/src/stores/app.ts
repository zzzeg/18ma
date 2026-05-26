import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  getNickName,
  getPhone,
  getRole,
  getToken,
  getUsername,
  removeNickName,
  removePhone,
  removeRole,
  removeToken,
  removeUsername,
  setNickName,
  setRole,
  setToken,
  setUsername,
} from '../utils/auth'
import { pinia } from './pinia'

export interface AppUser {
  username: string
  nickname: string
  contact?: string
  balance: number
  role: 'user' | 'admin'
}

const useAppStoreBase = defineStore('app', () => {
  const token = ref<string | null>(getToken())
  const username = ref<string | null>(getUsername() || getPhone())
  const nickname = ref<string>(getNickName() || '未命名用户')
  const role = ref<'user' | 'admin'>((getRole() as 'user' | 'admin') || 'user')
  const contact = ref('')
  const balance = ref(0)
  const unreadCount = ref(0)
  const sidebarCollapsed = ref(false)
  const mobileSidebarOpen = ref(false)

  const phone = computed(() => username.value)
  const isAuthenticated = computed(() => Boolean(token.value && username.value))
  const user = computed<AppUser | null>(() => {
    if (!username.value) return null
    return {
      username: username.value,
      nickname: nickname.value || '未命名用户',
      contact: contact.value,
      balance: balance.value,
      role: role.value,
    }
  })

  function login(nextToken: string, nextUsername: string, nextNickname?: string, nextRole: 'user' | 'admin' = 'user') {
    token.value = nextToken
    username.value = nextUsername
    nickname.value = nextNickname || nickname.value || '未命名用户'
    role.value = nextRole
    setToken(nextToken)
    setUsername(nextUsername)
    removePhone()
    setNickName(nickname.value)
    setRole(nextRole)
  }

  function logout() {
    token.value = null
    username.value = null
    nickname.value = '未命名用户'
    role.value = 'user'
    contact.value = ''
    unreadCount.value = 0
    removeToken()
    removeUsername()
    removePhone()
    removeNickName()
    removeRole()
  }

  function applyProfile(profile: { username?: string; phone?: string; nickname?: string; contact?: string; role?: 'user' | 'admin' }) {
    username.value = profile.username || profile.phone || username.value
    nickname.value = profile.nickname || nickname.value || '未命名用户'
    contact.value = profile.contact || ''
    role.value = profile.role || role.value || 'user'
    if (username.value) {
      setUsername(username.value)
    }
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
    username,
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
