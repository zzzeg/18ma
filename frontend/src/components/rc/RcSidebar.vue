<script setup lang="ts">
import { computed } from 'vue'
import { ElIcon, ElMenu, ElMenuItem, ElSubMenu, ElTooltip } from 'element-plus'
import { ArrowLeftBold, ArrowRightBold } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { adminNavItems } from '../../config/admin'
import { useAppStore } from '../../stores/app'

const props = defineProps<{ collapsed: boolean }>()

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const mainItems = computed(() => adminNavItems.filter((item) => item.group === 'main'))
const secondaryItems = computed(() => adminNavItems.filter((item) => item.group === 'secondary'))
const activeIndex = computed(() => {
  if (route.path === '/profile') {
    return `/profile?section=${String(route.query.section || 'info')}`
  }
  return route.path
})
const defaultOpeneds = computed(() => (route.path === '/profile' ? ['/profile'] : []))

function buildChildIndex(path: string, section?: string) {
  return section ? `${path}?section=${section}` : path
}

function handleSelect(index: string) {
  const [path, queryString] = index.split('?')
  if (!queryString) {
    router.push(path)
    store.toggleMobileSidebar(false)
    return
  }

  const params = new URLSearchParams(queryString)
  const section = params.get('section') || ''
  router.push({ path, query: section ? { section } : undefined })
  store.toggleMobileSidebar(false)
}
</script>

<template>
  <div class="sidebar-shell" :class="{ 'is-collapsed': props.collapsed, 'is-mobile-open': store.mobileSidebarOpen }">
    <aside class="sidebar">
      <div class="sidebar__brand" @click="router.push('/dashboard')">
        <div class="sidebar__brand-mark">R</div>
        <div v-if="!props.collapsed" class="sidebar__brand-copy">
          <strong>RegCode</strong>
          <span>Admin Console</span>
        </div>
      </div>

      <div class="sidebar__section">
        <span v-if="!props.collapsed" class="sidebar__group-title">主要功能</span>
        <el-menu :default-active="activeIndex" :default-openeds="defaultOpeneds" :collapse="props.collapsed"
          :collapse-transition="false" class="sidebar__menu" @select="handleSelect">
          <el-menu-item v-for="item in mainItems" :key="item.path" :index="item.path">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </el-menu>
      </div>

      <div class="sidebar__section">
        <span v-if="!props.collapsed" class="sidebar__group-title">系统与辅助</span>
        <el-menu :default-active="activeIndex" :default-openeds="defaultOpeneds" :collapse="props.collapsed"
          :collapse-transition="false" class="sidebar__menu" @select="handleSelect">
          <template v-for="item in secondaryItems" :key="item.path">
            <el-sub-menu v-if="item.children?.length" :index="item.path">
              <template #title>
                <el-icon>
                  <component :is="item.icon" />
                </el-icon>
                <span>{{ item.label }}</span>
              </template>
              <el-menu-item v-for="child in item.children" :key="buildChildIndex(child.path, child.query?.section)"
                :index="buildChildIndex(child.path, child.query?.section)">
                {{ child.label }}
              </el-menu-item>
            </el-sub-menu>

            <el-menu-item v-else :index="item.path">
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <template #title>{{ item.label }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </div>
    </aside>

    <ElTooltip :content="props.collapsed ? '展开侧边栏' : '折叠侧边栏'" placement="right" :show-after="120">
      <button class="sidebar__trigger" @click="store.toggleSidebar()">
        <ElIcon>
          <ArrowLeftBold v-if="!props.collapsed" />
          <ArrowRightBold v-else />
        </ElIcon>
      </button>
    </ElTooltip>
  </div>
</template>

<style scoped lang="scss">
.sidebar-shell {
  --sidebar-width: 210px;
  position: fixed;
  inset: 0 auto 0 0;
  width: calc(var(--sidebar-width) + 24px);
  z-index: 40;
  transition: width 0.24s ease, transform 0.24s ease;

  &.is-collapsed {
    --sidebar-width: 80px;
  }

  &:hover .sidebar__trigger,
  .sidebar__trigger:hover {
    opacity: 1;
    pointer-events: auto;
  }
}

.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  padding: 0px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff;
  box-shadow: inset -1px 0 0 var(--rc-border);

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 0 16px;
    cursor: pointer;
  }

  &__brand-mark {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: var(--rc-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }

  &__brand-copy {
    display: flex;
    flex-direction: column;
    line-height: 1.2;

    strong {
      font-size: 16px;
      color: var(--rc-text);
      font-weight: 600;
    }

    span {
      font-size: 11px;
      color: var(--rc-text-muted);
      letter-spacing: 0.04em;
    }
  }

  &__section {
    display: grid;
    gap: 4px;
    padding: 0 10px;
  }

  &__group-title {
    padding: 10px 8px 6px;
    color: var(--rc-text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__menu {
    border-right: none;
    background: transparent;
  }

  &__trigger {
    position: absolute;
    left: calc(var(--sidebar-width) - 1px);
    top: 50%;
    width: 24px;
    height: 48px;
    transform: translateY(-50%);
    border: 1px solid var(--rc-border);
    border-radius: 0 6px 6px 0;
    background: #fff;
    color: var(--rc-text-soft);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 21, 41, 0.08);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, left 0.24s ease;
  }
}

:deep(.sidebar__menu.el-menu) {
  border-right: none;
  background: transparent;
}

:deep(.sidebar__menu .el-menu-item),
:deep(.sidebar__menu .el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
  margin-bottom: 4px;
  border-radius: 6px;
  color: var(--rc-text-soft);
  font-size: 14px;
  font-weight: 500;
}

:deep(.sidebar__menu .el-menu-item:hover),
:deep(.sidebar__menu .el-sub-menu__title:hover) {
  background: #f5f7fa;
  color: var(--rc-primary);
}

:deep(.sidebar__menu .el-menu-item.is-active) {
  background: var(--el-color-primary) !important;
  color: #fff;
}



:deep(.sidebar__menu .el-sub-menu .el-menu) {
  background: transparent;
}

:deep(.sidebar__menu .el-sub-menu .el-menu-item) {
  height: 34px;
  line-height: 34px;
  margin-left: 10px;
  padding-left: 38px !important;
  font-size: 13px;
}

:deep(.sidebar__menu .el-sub-menu.is-active > .el-sub-menu__title) {
  background: var(--el-color-primary);
  color: #fff;
}



:deep(.sidebar__menu .el-menu-item .el-icon),
:deep(.sidebar__menu .el-sub-menu__title .el-icon) {
  font-size: 15px;
  margin-right: 10px;
}

.sidebar-shell.is-collapsed {

  :deep(.sidebar__menu .el-menu-item),
  :deep(.sidebar__menu .el-sub-menu__title) {
    padding: 0 !important;
    justify-content: center;
  }

  :deep(.sidebar__menu .el-menu-item .el-icon),
  :deep(.sidebar__menu .el-sub-menu__title .el-icon) {
    margin-right: 0;
  }

  .sidebar__brand {
    justify-content: center;
    padding: 0;
  }

  .sidebar__section {
    padding: 0 8px;
  }
}

:deep(.sidebar__menu .el-sub-menu.is-active.is-opened > .el-sub-menu__title) {
  background: none;
  color: var(--rc-text-soft);
}

@media (max-width: 960px) {
  .sidebar-shell {
    transform: translateX(-100%);

    &.is-mobile-open {
      transform: translateX(0);
    }
  }

  .sidebar__trigger {
    display: none;
  }
}
</style>
