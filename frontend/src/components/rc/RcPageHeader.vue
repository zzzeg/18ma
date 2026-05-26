<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; path?: string }>
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__left">
      <div v-if="breadcrumbs?.length" class="page-header__breadcrumbs">
        <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb.label}-${index}`">
          <router-link v-if="crumb.path" :to="crumb.path">{{ crumb.label }}</router-link>
          <span v-else>{{ crumb.label }}</span>
          <span v-if="index < breadcrumbs.length - 1">/</span>
        </template>
      </div>
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  &__left {
    min-width: 0;
  }

  &__breadcrumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    color: var(--rc-text-muted);
    font-size: 13px;
    font-weight: 400;
  }

  &__title {
    margin: 0;
    font-size: 24px;
    line-height: 1.3;
    font-weight: 600;
  }

  &__subtitle {
    margin: 6px 0 0;
    color: var(--rc-text-soft);
    font-size: 13px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;

    &__title {
      font-size: 22px;
    }

    &__actions {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }
  }
}
</style>
