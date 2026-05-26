<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ElIcon } from 'element-plus'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    prefix?: string
    suffix?: string
    icon?: Component
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'slate'
    trend?: string
    badge?: string
    strong?: boolean
  }>(),
  {
    tone: 'primary',
    strong: false,
  },
)

const cardClass = computed(() => [`rc-stat-card--${props.tone}`, props.strong ? 'rc-stat-card--strong' : ''])
</script>

<template>
  <section class="rc-stat-card panel" :class="cardClass">
    <div class="rc-stat-card__head">
      <div>
        <div class="rc-stat-card__label">{{ label }}</div>
      </div>
      <div v-if="icon" class="rc-stat-card__icon">
        <ElIcon>
          <component :is="icon" />
        </ElIcon>
      </div>
      <div v-else-if="badge" class="rc-stat-card__badge">{{ badge }}</div>
    </div>
    <div class="rc-stat-card__value mono">
      <span v-if="prefix" class="rc-stat-card__prefix">{{ prefix }}</span>{{ value }}<span v-if="suffix"
        class="rc-stat-card__suffix">{{ suffix }}</span>
    </div>
    <div v-if="trend" class="rc-stat-card__trend">{{ trend }}</div>
  </section>
</template>

<style scoped lang="scss">
.rc-stat-card {
  padding: 18px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  &__label {
    color: var(--rc-text-soft);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  &__icon,
  &__badge {
    width: 36px;
    height: 36px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--rc-primary-soft);
    color: var(--rc-primary);
  }

  &__value {
    margin-top: 14px;
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
  }

  &__prefix,
  &__suffix {
    font-size: 14px;
    font-weight: 500;
  }

  &__trend {
    margin-top: 12px;
    color: var(--rc-text-soft);
    font-size: 13px;
    font-weight: 400;
  }

  &--strong {
    background: linear-gradient(135deg, #409eff, #66b1ff 72%);
    color: #fff;

    .rc-stat-card__label,
    .rc-stat-card__trend {
      color: rgba(255, 255, 255, 0.72);
    }

    .rc-stat-card__icon,
    .rc-stat-card__badge {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
  }

  &--success .rc-stat-card__icon,
  &--success .rc-stat-card__badge {
    background: rgba(103, 194, 58, 0.16);
    color: #53a22c;
  }

  &--warning .rc-stat-card__icon,
  &--warning .rc-stat-card__badge {
    background: rgba(230, 162, 60, 0.16);
    color: #c7892b;
  }

  &--danger .rc-stat-card__icon,
  &--danger .rc-stat-card__badge {
    background: rgba(186, 26, 26, 0.12);
    color: #ba1a1a;
  }

  &--slate .rc-stat-card__icon,
  &--slate .rc-stat-card__badge {
    background: #f4f4f5;
    color: #64748b;
  }
}
</style>
