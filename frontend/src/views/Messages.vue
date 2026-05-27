<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { messagesApi, type MessageEntryRecord, type MessageThreadRecord } from '../api/services'
import { useAppStore } from '../stores/app'

type FilterType = 'all' | 'support' | 'system' | 'guestbook'

const store = useAppStore()
const loading = ref(false)
const sending = ref(false)
const sessionCreating = ref(false)
const activeFilter = ref<FilterType>('all')
const allThreads = ref<MessageThreadRecord[]>([])
const threads = ref<MessageThreadRecord[]>([])
const activeThreadId = ref<number | null>(null)
const messages = ref<MessageEntryRecord[]>([])
const draft = ref('')
let pollTimer: number | undefined

const isAdmin = computed(() => store.role === 'admin')
const tabs = [
  { label: '全部消息', value: 'all' as FilterType },
  { label: '对话工单', value: 'support' as FilterType },
  { label: '系统通知', value: 'system' as FilterType },
  { label: '留言板', value: 'guestbook' as FilterType },
]

const activeThread = computed(() => allThreads.value.find((item) => item.id === activeThreadId.value) || null)
const showComposer = computed(() => Boolean(activeThread.value?.canReply))
const showReconnectAction = computed(() => !isAdmin.value && activeThread.value?.type === 'support' && activeThread.value?.sessionExpired)
const composerPlaceholder = computed(() => {
  if (!activeThread.value?.canReply) return '当前线程不可回复'
  if (activeThread.value.type === 'guestbook') return '输入需求留言、补充说明或排期备注'
  if (isAdmin.value) return '输入回复内容，将直接发送给该用户'
  return '输入消息内容，提交后会转入管理员待处理队列'
})
const composerHint = computed(() => {
  if (!activeThread.value) return ''
  if (activeThread.value.type === 'support') return '对话工单连续 10 分钟无新消息会自动断开'
  if (activeThread.value.type === 'guestbook') return '留言板为长期线程，适合非即时沟通内容'
  return '系统通知仅支持查看'
})
const composerNoticeTitle = computed(() => {
  if (!activeThread.value) return '暂无可回复会话'
  if (activeThread.value.type === 'system') return '系统通知仅支持查看'
  if (activeThread.value.status === 'closed') return '当前会话已关闭'
  if (activeThread.value.sessionExpired) return '当前工单会话已超时'
  return '当前线程不可回复'
})
const composerNoticeText = computed(() => {
  if (!activeThread.value) return '当前筛选下没有可查看的消息线程。'
  if (activeThread.value.type === 'system') return '该线程由平台下发通知，注册用户和管理员当前都不可直接回复。'
  if (activeThread.value.status === 'closed') return '如需继续沟通，请创建新的对话工单或改用留言板补充信息。'
  if (activeThread.value.sessionExpired) {
    return isAdmin.value
      ? '该工单已超过 10 分钟无新消息，需等待用户重新发起新的会话。'
      : '该工单已超过 10 分钟无新消息，点击右侧按钮可重新发起新的会话。'
  }
  return '当前线程暂不支持发送消息。'
})

function sortThreads(list: MessageThreadRecord[]) {
  return [...list].sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime())
}

function mergeThreadIntoList(list: MessageThreadRecord[], thread: MessageThreadRecord) {
  const existed = list.some((item) => item.id === thread.id)
  const next = existed
    ? list.map((item) => (item.id === thread.id ? { ...item, ...thread } : item))
    : [...list, thread]
  return sortThreads(next)
}

function updateThreadState(thread: MessageThreadRecord) {
  allThreads.value = mergeThreadIntoList(allThreads.value, thread)
  if (activeFilter.value === 'all' || activeFilter.value === thread.type) {
    threads.value = mergeThreadIntoList(threads.value, thread)
  } else {
    threads.value = threads.value.map((item) => (item.id === thread.id ? { ...item, ...thread } : item))
  }
}

function unreadCountByType(type: Exclude<FilterType, 'all'>) {
  return allThreads.value
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.unreadCount || 0), 0)
}

function adminPendingCountByType(type: Exclude<FilterType, 'all'>) {
  return allThreads.value
    .filter((item) => item.type === type && item.needsReply)
    .length
}

function tabBadgeCount(type: FilterType) {
  if (isAdmin.value) {
    if (type === 'all') {
      return adminPendingCountByType('support') + adminPendingCountByType('system') + adminPendingCountByType('guestbook')
    }
    return adminPendingCountByType(type)
  }

  if (type === 'all') {
    return unreadCountByType('support') + unreadCountByType('system') + unreadCountByType('guestbook')
  }
  return unreadCountByType(type)
}

function threadIndicatorText(thread: MessageThreadRecord) {
  if (isAdmin.value) {
    return thread.needsReply ? '待处理' : ''
  }
  return thread.unreadCount ? String(thread.unreadCount) : ''
}

function formatRelativeTime(value: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function threadStatusText(thread: MessageThreadRecord) {
  if (thread.status === 'waiting_admin') {
    return isAdmin.value ? '待我处理' : '待管理员回复'
  }
  if (thread.status === 'waiting_user') {
    return isAdmin.value ? '待用户继续' : '待我继续'
  }

  return (
    {
      open: '处理中',
      pending: '待跟进',
      expired: '会话已超时',
      closed: '已关闭',
    }[thread.status] || thread.status
  )
}

function threadTypeText(type: MessageThreadRecord['type']) {
  return (
    {
      support: '对话工单',
      system: '系统通知',
      guestbook: '留言板',
    }[type] || type
  )
}

function panelTagText(thread: MessageThreadRecord) {
  if (thread.needsReply) return '待处理'
  if (thread.type === 'system') return '只读'
  if (thread.status === 'waiting_admin') return isAdmin.value ? '待我处理' : '待回复'
  if (thread.status === 'waiting_user') return isAdmin.value ? '待用户继续' : '待我继续'
  if (thread.sessionExpired) return '已超时'
  return thread.priority === 'high' ? '高优先级' : '常规会话'
}

function messageRoleText(role: MessageEntryRecord['role']) {
  if (role === 'system') return '系统'
  if (isAdmin.value) {
    return role === 'admin' ? '我' : '用户'
  }
  return role === 'user' ? '我' : '管理员'
}

function isOwnMessage(item: MessageEntryRecord) {
  return isAdmin.value ? item.role === 'admin' : item.role === 'user'
}

function bubbleClasses(item: MessageEntryRecord) {
  const sideClass = item.role === 'system' ? 'bubble--system' : isOwnMessage(item) ? 'bubble--mine' : 'bubble--peer'
  return [sideClass, `bubble--${item.type}`]
}

async function syncSummary() {
  try {
    const summary = await messagesApi.getSummary()
    store.setUnreadCount(summary.unreadCount || 0)
  } catch {
    store.setUnreadCount(0)
  }
}

async function selectThread(id: number, shouldSyncSummary = true) {
  try {
    const detail = await messagesApi.getThreadDetail(id)
    activeThreadId.value = detail.thread.id
    messages.value = detail.messages
    updateThreadState(detail.thread)
    if (shouldSyncSummary) {
      await syncSummary()
    }
  } catch (error: any) {
    ElMessage.error(error.error || '加载消息失败')
  }
}

async function loadThreads(keepSelection = true, preferredThreadId: number | null = null) {
  loading.value = true
  try {
    const [allData, filteredData] = await Promise.all([
      messagesApi.getThreads('all'),
      messagesApi.getThreads(activeFilter.value),
    ])

    allThreads.value = sortThreads(allData)
    threads.value = sortThreads(filteredData)

    const candidateId =
      preferredThreadId ??
      (keepSelection && filteredData.some((item) => item.id === activeThreadId.value)
        ? activeThreadId.value
        : filteredData[0]?.id ?? null)

    if (!candidateId) {
      activeThreadId.value = null
      messages.value = []
      await syncSummary()
      return
    }

    await selectThread(candidateId, false)
    await syncSummary()
  } catch (error: any) {
    allThreads.value = []
    threads.value = []
    activeThreadId.value = null
    messages.value = []
    store.setUnreadCount(0)
    ElMessage.error(error.error || '加载消息会话失败')
  } finally {
    loading.value = false
  }
}

async function ensureSupportSessionAndOpen() {
  sessionCreating.value = true
  try {
    const thread = await messagesApi.ensureSupportSession()
    activeFilter.value = 'support'
    await loadThreads(true, thread.id)
  } catch (error: any) {
    ElMessage.error(error.error || '创建会话失败')
  } finally {
    sessionCreating.value = false
  }
}

async function handleFilterChange(next: FilterType) {
  activeFilter.value = next
  if (!isAdmin.value && next === 'support') {
    await ensureSupportSessionAndOpen()
    return
  }
  await loadThreads(true)
}

async function sendMessage() {
  if (!activeThread.value?.canReply) return
  if (!draft.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }

  sending.value = true
  try {
    await messagesApi.sendMessage(activeThread.value.id, {
      content: draft.value.trim(),
      messageType: activeThread.value.type === 'guestbook' ? 'note' : 'chat',
    })
    const currentId = activeThread.value.id
    draft.value = ''
    await loadThreads(true, currentId)
  } catch (error: any) {
    if (error.code === 'SUPPORT_THREAD_EXPIRED') {
      await loadThreads(true, activeThread.value.id)
    }
    ElMessage.error(error.error || '发送失败')
  } finally {
    sending.value = false
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(async () => {
  await loadThreads(false)
  pollTimer = window.setInterval(() => {
    void loadThreads(true)
  }, 20000)
})

onBeforeUnmount(() => {
  if (pollTimer) window.clearInterval(pollTimer)
})
</script>

<template>
  <div class="page-shell messages-page" v-loading="loading">
    <section class="panel chat-shell">
      <aside class="thread-list">
        <div class="thread-list__tabs">
          <button v-for="tab in tabs" :key="tab.value" :class="{ 'is-active': activeFilter === tab.value }"
            @click="handleFilterChange(tab.value)">
            <el-badge :value="tabBadgeCount(tab.value)" :hidden="tabBadgeCount(tab.value) === 0" :offset="[30, 0]">
              <span>{{ tab.label }}</span>
            </el-badge>
          </button>
        </div>
        <div class="thread-list__toolbar">
          <el-button @click="loadThreads(true)" type="primary">刷新会话</el-button>
        </div>

        <button v-for="thread in threads" :key="thread.id" class="thread-item"
          :class="{ 'is-active': activeThreadId === thread.id }" @click="selectThread(thread.id)">
          <div class="thread-item__row">
            <strong>{{ thread.title }}</strong>
            <span>{{ formatRelativeTime(thread.lastMessageAt) }}</span>
          </div>
          <p>{{ thread.preview }}</p>
          <div class="thread-item__meta">
            <small>{{ threadStatusText(thread) }}</small>
            <em v-if="threadIndicatorText(thread)">{{ threadIndicatorText(thread) }}</em>
          </div>
          <div v-if="isAdmin && thread.userPhone" class="thread-item__owner">
            <span>{{ thread.userNickname || '未命名用户' }}</span>
            <small>{{ thread.userPhone }}</small>
          </div>
        </button>
      </aside>

      <main class="chat-panel">
        <template v-if="activeThread">
          <header class="chat-panel__header">
            <div>
              <strong>{{ activeThread.title }}</strong>
              <small>{{ threadStatusText(activeThread) }} · {{ threadTypeText(activeThread.type) }}</small>
              <small v-if="isAdmin && activeThread.userPhone" class="chat-panel__owner">
                {{ activeThread.userNickname || '未命名用户' }} · {{ activeThread.userPhone }}
              </small>
            </div>
            <span class="chat-panel__tag">{{ panelTagText(activeThread) }}</span>
          </header>

          <div class="chat-panel__messages">
            <div v-for="item in messages" :key="item.id" class="bubble" :class="bubbleClasses(item)">
              <label>{{ messageRoleText(item.role) }}</label>
              <p>{{ item.text }}</p>
              <span>{{ formatRelativeTime(item.time) }}</span>
            </div>
          </div>

          <footer v-if="showComposer" class="chat-panel__composer">
            <textarea v-model="draft" :placeholder="composerPlaceholder" @keydown="handleComposerKeydown" />
            <div class="chat-panel__actions">
              <small>{{ composerHint }}</small>
              <el-button type="primary" :loading="sending" @click="sendMessage">
                <el-icon>
                  <Promotion />
                </el-icon>
                发送
              </el-button>
            </div>
          </footer>

          <footer v-else class="chat-panel__notice">
            <div>
              <strong>{{ composerNoticeTitle }}</strong>
              <p>{{ composerNoticeText }}</p>
            </div>
            <el-button v-if="showReconnectAction" type="primary" :loading="sessionCreating"
              @click="ensureSupportSessionAndOpen">
              重新发起会话
            </el-button>
          </footer>
        </template>

        <div v-else class="chat-empty">
          <strong>暂无消息线程</strong>
          <p>当前筛选下没有可查看的会话或留言。</p>
        </div>
      </main>
    </section>
  </div>
</template>

<style scoped lang="scss">
.messages-page {
  display: grid;
  gap: 16px;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.chat-shell {
  padding: 16px;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.thread-list {
  background: #fafafa;
  border: 1px solid var(--rc-border);
  border-radius: 4px;
  padding: 12px;
  min-height: 0;
  overflow: auto;

  &__tabs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 12px;

    button {
      min-height: 34px;
      border: 1px solid var(--rc-border);
      border-radius: 4px;
      background: #fff;
      color: var(--rc-text-soft);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;

      &.is-active {
        background: var(--rc-primary-soft);
        border-color: #c6e2ff;
        color: var(--rc-primary);
      }
    }

    :deep(.el-badge__content) {
      border: none;
      box-shadow: none;
    }
  }

  &__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }
}

.thread-item {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  padding: 12px;
  cursor: pointer;
  margin-bottom: 8px;

  &__row,
  &__meta,
  &__owner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__row span,
  p,
  small {
    color: var(--rc-text-soft);
  }

  p {
    margin: 8px 0;
    line-height: 1.7;
  }

  &__owner {
    margin-top: 6px;

    span {
      color: var(--rc-text-main);
      font-size: 13px;
      font-weight: 500;
    }
  }

  em {
    min-width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #fef0f0;
    color: var(--rc-danger);
    font-style: normal;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    white-space: nowrap;
  }

  &.is-active,
  &:hover {
    background: var(--rc-primary-soft);
    border-color: #d9ecff;
  }
}

.chat-panel {
  border: 1px solid var(--rc-border);
  border-radius: 4px;
  background: #fff;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 0;
  overflow: hidden;

  &__header {
    padding: 16px 18px;
    border-bottom: 1px solid var(--rc-border);
    display: flex;
    justify-content: space-between;
    gap: 12px;

    strong,
    small {
      display: block;
    }

    small {
      margin-top: 6px;
      color: var(--rc-text-soft);
    }
  }

  &__owner {
    color: var(--rc-text-main);
  }

  &__tag {
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--rc-primary-soft);
    color: var(--rc-primary);
    font-size: 12px;
    font-weight: 500;
  }

  &__messages {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: #fff;
    overflow: auto;
    min-height: 0;
  }

  &__composer,
  &__notice {
    padding: 16px 18px;
    border-top: 1px solid var(--rc-border);
  }

  &__composer {
    display: grid;
    gap: 12px;

    textarea {
      width: 100%;
      min-height: 120px;
      border: 1px solid var(--rc-border-strong);
      border-radius: 4px;
      background: #fff;
      padding: 12px 14px;
      resize: vertical;
      outline: none;
    }
  }

  &__notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    strong {
      display: block;
      margin-bottom: 6px;
    }

    p {
      margin: 0;
      color: var(--rc-text-soft);
      line-height: 1.7;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    small {
      color: var(--rc-text-soft);
    }
  }
}

.bubble {
  width: fit-content;
  max-width: 70%;
  padding: 14px 16px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--rc-border);

  &--mine {
    align-self: flex-end;
    background: #eef6ff;
    border-color: #cfe4ff;
    color: #1f4d80;

    label,
    span {
      color: #4c78a9;
    }
  }

  &--peer {
    align-self: flex-start;
    background: #f8fbff;
    border-color: #dbe7f5;
    color: #31455f;
  }

  &--system {
    align-self: flex-start;
    border-color: #d9ecff;
    background: #f5fafe;
  }

  &--note {
    border-left: 3px solid #67c23a;
  }

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--rc-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  p {
    margin: 0;
    line-height: 1.8;
  }

  span {
    display: block;
    margin-top: 8px;
    color: var(--rc-text-soft);
    font-size: 12px;
  }
}

.chat-empty {
  margin-top: 100px;
  display: grid;
  place-items: center;
  text-align: center;
  color: var(--rc-text-soft);
}

@media (max-width: 1180px) {
  .chat-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .thread-list__tabs {
    grid-template-columns: 1fr;
  }

  .bubble {
    max-width: 100%;
  }

  .chat-panel__actions,
  .chat-panel__notice {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
