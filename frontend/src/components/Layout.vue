<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '../stores/app'
import RcHeader from './rc/RcHeader.vue'
import RcSidebar from './rc/RcSidebar.vue'

const route = useRoute()
const store = useAppStore()

const plainRoutes = new Set(['login', 'register', 'index', 'share', 'service-protocol'])
const isPlainPage = computed(() => plainRoutes.has(String(route.name)))
const isMessagesPage = computed(() => String(route.name) === 'messages')
</script>

<template>
  <div class="layout-root">
    <router-view v-if="isPlainPage" />
    <template v-else>
      <RcSidebar :collapsed="store.sidebarCollapsed" />
      <div class="layout-main" :class="{ 'is-collapsed': store.sidebarCollapsed }">
        <RcHeader />
        <main class="layout-content" :class="{ 'layout-content--messages': isMessagesPage }">
          <router-view />
        </main>
      </div>
      <div v-if="store.mobileSidebarOpen" class="layout-mask" @click="store.toggleMobileSidebar(false)" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.layout-root {
  min-height: 100vh;
}

.layout-main {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 100vh;
  margin-left: 210px;
  overflow: hidden;
  transition: margin-left 0.24s ease;

  &.is-collapsed {
    margin-left: 80px;
  }
}

.layout-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

.layout-content--messages {
  overflow: hidden;
}

.layout-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.24);
  z-index: 35;
}

@media (max-width: 960px) {

  .layout-main,
  .layout-main.is-collapsed {
    margin-left: 0;
  }

  .layout-content {
    padding: 12px;
  }
}
</style>
