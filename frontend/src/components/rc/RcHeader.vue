<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { ElIcon } from 'element-plus'
import { Bell, SwitchButton } from '@element-plus/icons-vue'
import type { RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'
import { adminNavItems } from '../../config/admin'
import { messagesApi, profileApi } from '../../api/services'
import { useAppStore } from '../../stores/app'
import { initials } from '../../utils/utils'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
let unreadTimer: number | undefined
const userLabel = computed(() => store.nickname || store.user?.nickname || '未命名用户')

interface BreadcrumbItem {
  label: string
  to?: RouteLocationRaw
}

const routeLabelMap: Record<string, string> = {
  '/upload': '发布资源',
  '/about': '关于',
  '/withdraw-account': '提现账户',
  '/withdrawals': '提现记录',
  '/withdraw-apply': '提现申请',
  '/service-protocol': '服务协议',
}

const breadcrumbItems = computed<BreadcrumbItem[]>(() => {
  const currentPath = route.path
  if (currentPath === '/dashboard') {
    return [{ label: '概览' }]
  }

  const items: BreadcrumbItem[] = [{ label: '概览', to: '/dashboard' }]
  const profileNav = adminNavItems.find((item) => item.path === '/profile')
  const matchedNav = adminNavItems.find((item) => item.path === currentPath)

  if (currentPath === '/profile' && profileNav) {
    items.push({ label: profileNav.label, to: '/profile' })
    const section = String(route.query.section || 'info')
    const matchedSection = profileNav.children?.find((item) => item.query?.section === section)
    if (matchedSection) {
      items.push({ label: matchedSection.label })
    }
    return items
  }

  const pageLabel = matchedNav?.label || routeLabelMap[currentPath]
  if (pageLabel) {
    items.push({ label: pageLabel })
  }

  return items
})

async function bootstrapProfile() {
  if (!store.isAuthenticated) return
  try {
    const profile = await profileApi.getProfile()
    store.applyProfile(profile)
  } catch {
    // handled by interceptor when token is invalid
  }
}

async function bootstrapUnread() {
  if (!store.isAuthenticated) return
  try {
    const summary = await messagesApi.getSummary()
    store.setUnreadCount(summary.unreadCount || 0)
  } catch {
    store.setUnreadCount(0)
  }
}

function openMessages() {
  router.push('/messages')
}

function openProfile() {
  router.push('/profile')
}

function logout() {
  store.logout()
  router.push('/login')
}

onMounted(() => {
  void bootstrapProfile()
  void bootstrapUnread()
  unreadTimer = window.setInterval(() => {
    void bootstrapUnread()
  }, 30000)
})

onBeforeUnmount(() => {
  if (unreadTimer) window.clearInterval(unreadTimer)
})
</script>

<template>
  <header class="header">
    <div class="header__left">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`" :to="item.to">
          {{ item.label }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header__right">
      <button class="header__icon" @click="openMessages">
        <ElIcon>
          <Bell />
        </ElIcon>
        <span v-if="store.unreadCount" class="header__badge">{{ store.unreadCount }}</span>
      </button>
      <button class="header__profile" @click="openProfile">
        <span class="header__avatar">{{ initials(userLabel) }}</span>
        <span class="header__profile-copy">
          <strong>{{ userLabel }}</strong>
          <small>账号：{{ store.phone || '--' }}</small>
        </span>
      </button>
      <button class="header__logout" @click="logout">
        <ElIcon>
          <SwitchButton />
        </ElIcon>
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.header {
  position: sticky;
  top: 0;
  z-index: 30;
  // margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--rc-card);

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__left {
    flex: 1;
    min-width: 0;

    :deep(.el-breadcrumb) {
      min-width: 0;
      line-height: 1;
    }

    :deep(.el-breadcrumb__item) {
      min-width: 0;
    }

    :deep(.el-breadcrumb__inner) {
      color: var(--rc-text-soft);
      font-size: 14px;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    :deep(.el-breadcrumb__inner.is-link:hover),
    :deep(.el-breadcrumb__inner a:hover) {
      color: var(--rc-primary);
    }

    :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
      color: var(--rc-text);
      font-weight: 600;
    }

    :deep(.el-breadcrumb__separator) {
      color: var(--rc-text-muted);
      margin: 0 8px;
    }
  }

  &__menu,
  &__icon,
  &__logout {
    width: 34px;
    height: 34px;
    border: 1px solid var(--rc-border);
    border-radius: 4px;
    background: #fff;
    color: var(--rc-text-soft);
    cursor: pointer;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__menu {
    display: none;
  }

  &__badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 18px;
    height: 18px;
    border-radius: 999px;
    background: var(--rc-danger);
    color: #fff;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  &__profile {
    border: 1px solid var(--rc-border);
    background: #fff;
    border-radius: 4px;
    padding: 4px 10px 4px 4px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  &__avatar {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: var(--rc-primary);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  &__profile-copy {
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    strong {
      font-size: 13px;
      line-height: 1.1;
      font-weight: 500;
    }

    small {
      color: var(--rc-text-soft);
      font-size: 11px;
    }
  }
}

@media (max-width: 960px) {
  .header {
    margin: 0 0 12px;
    padding: 10px 12px;

    &__menu {
      display: inline-flex;
    }

    &__profile-copy,
    &__logout {
      display: none;
    }
  }
}
</style>
