<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    type?: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'default'
    text: string
    showDot?: boolean
  }>(),
  {
    type: 'default',
    showDot: false,
  },
)

const tagClass = computed(() => `rc-tag--${props.type}`)
</script>

<template>
  <span class="rc-tag" :class="tagClass">
    <span v-if="showDot" class="rc-tag__dot" />
    <span>{{ text }}</span>
  </span>
</template>

<style scoped lang="scss">
.rc-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;

  &__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  &--success {
    color: #53a22c;
    background: rgba(103, 194, 58, 0.14);
  }

  &--warning {
    color: #c7892b;
    background: rgba(230, 162, 60, 0.14);
  }

  &--error {
    color: #ba1a1a;
    background: rgba(186, 26, 26, 0.12);
  }

  &--primary {
    color: var(--rc-primary);
    background: rgba(0, 96, 169, 0.1);
  }

  &--info,
  &--default {
    color: #6f7c94;
    background: #eef2f9;
  }
}
</style>
