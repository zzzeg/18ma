<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { DataLine, Files, Tickets } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  shareApi,
  type DashboardDistributionRow,
  type DashboardRecentRecord,
  type DashboardSummaryResponse,
  type DashboardTrendRow,
} from '../api/services'
import RcStatCard from '../components/rc/RcStatCard.vue'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { quickLinks } from '../config/admin'
import { useAppStore } from '../stores/app'
import { formatDate, formatNumber } from '../utils/utils'

const router = useRouter()
const store = useAppStore()
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const dashboard = ref<DashboardSummaryResponse>({
  summary: {
    resourceCount: 0,
    unusedCodeCount: 0,
    usedCodeCount: 0,
    disabledCodeCount: 0,
    totalRedeemCount: 0,
    activeAuthorizationCount: 0,
    expiredAuthorizationCount: 0,
  },
  distribution: [],
  trend: [],
  recentRecords: [],
})

const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function resourceTypeText(type?: string) {
  return ({ file: '文件', cloud: '网盘', url: '链接', text: '文本信息' } as Record<string, string>)[type || ''] || type || '文件'
}

function roleText(role?: 'user' | 'admin') {
  return role === 'admin' ? '超级管理员' : '用户'
}

function recordStatusText(status: DashboardRecentRecord['status']) {
  return ({ active: '有效', expired: '已过期', revoked: '已撤销' } as Record<string, string>)[status] || status
}

function recordStatusType(status: DashboardRecentRecord['status']) {
  return ({ active: 'success', expired: 'warning', revoked: 'info' } as Record<string, 'success' | 'warning' | 'info'>)[status] || 'info'
}

function handleSizeChange(value: number) {
  pageSize.value = value
  currentPage.value = 1
}

function handleCurrentChange(value: number) {
  currentPage.value = value
}

const accountScopeText = computed(() =>
  store.role === 'admin' ? '可查看全部资源、卡密与兑换记录。' : '仅查看自己的资源、卡密与兑换记录。',
)

const distribution = computed(() => {
  if (!dashboard.value.distribution.length) {
    return [{ label: '暂无资源', count: 0, value: 100, color: '#cbd5e1' }]
  }

  const total = dashboard.value.summary.resourceCount || 1
  const colors = ['#0e67af', '#4f9df1', '#67c23a', '#e6a23c']
  const order = ['file', 'cloud', 'url', 'text']

  return [...dashboard.value.distribution]
    .sort((a, b) => order.indexOf(a.resourceType) - order.indexOf(b.resourceType))
    .map((item: DashboardDistributionRow, index) => ({
      label: resourceTypeText(item.resourceType),
      count: Number(item.count || 0),
      value: Math.round((Number(item.count || 0) / total) * 100),
      color: colors[index % colors.length],
    }))
})

const resourceBreakdownText = computed(() => {
  const visible = distribution.value.filter((item) => item.count > 0)
  if (!visible.length) return '暂无资源'
  return visible.map((item) => `${item.label} ${formatNumber(item.count)}`).join(' / ')
})

const statCards = computed(() => [
  {
    label: '已发布资源数',
    value: dashboard.value.summary.resourceCount,
    suffix: '项',
    trend: resourceBreakdownText.value,
    icon: Files,
    strong: true as boolean | undefined,
  },
  {
    label: '可用卡密数',
    value: dashboard.value.summary.unusedCodeCount,
    suffix: '张',
    trend: `已兑换 ${formatNumber(dashboard.value.summary.usedCodeCount)} / 已停用 ${formatNumber(dashboard.value.summary.disabledCodeCount)}`,
    icon: Tickets,
    strong: undefined,
  },
  {
    label: '当前有效授权',
    value: dashboard.value.summary.activeAuthorizationCount,
    suffix: '条',
    trend: `累计兑换 ${formatNumber(dashboard.value.summary.totalRedeemCount)} / 已过期 ${formatNumber(dashboard.value.summary.expiredAuthorizationCount)}`,
    icon: DataLine,
    strong: undefined,
  },
])

const trendTotalLast7 = computed(() => dashboard.value.trend.reduce((sum, item) => sum + Number(item.count || 0), 0))

const weeklyBars = computed(() => {
  const source = dashboard.value.trend.length
    ? dashboard.value.trend
    : Array.from({ length: 7 }, () => ({ date: '', count: 0 } as DashboardTrendRow))

  const maxCount = Math.max(...source.map((item) => Number(item.count || 0)), 0)

  return source.map((item) => {
    const date = item.date ? new Date(item.date) : null
    return {
      label: date && !Number.isNaN(date.getTime()) ? weekLabels[date.getDay()] : '--',
      count: Number(item.count || 0),
      height: Number(item.count || 0) > 0 && maxCount ? Math.max(10, Math.round((Number(item.count || 0) / maxCount) * 100)) : 0,
    }
  })
})

const donutStyle = computed(() => {
  let offset = 0
  const segments = distribution.value.map((item) => {
    const start = offset
    offset += item.value
    return `${item.color} ${start}% ${offset}%`
  })
  return { background: `conic-gradient(${segments.join(', ')})` }
})

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return dashboard.value.recentRecords.slice(start, start + pageSize.value)
})

async function loadData() {
  loading.value = true
  try {
    dashboard.value = await shareApi.getDashboardSummary()
    store.updateBalance(0)
  } catch {
    dashboard.value = {
      summary: {
        resourceCount: 0,
        unusedCodeCount: 0,
        usedCodeCount: 0,
        disabledCodeCount: 0,
        totalRedeemCount: 0,
        activeAuthorizationCount: 0,
        expiredAuthorizationCount: 0,
      },
      distribution: [],
      trend: [],
      recentRecords: [],
    }
    store.updateBalance(0)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="page-shell dashboard-page" v-loading="loading">
    <section class="metric-grid">
      <RcStatCard
        v-for="card in statCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :suffix="card.suffix"
        :icon="card.icon"
        :trend="card.trend"
        :strong="card.strong"
      />
      <article class="security-card panel">
        <div class="security-card__label">当前账号身份</div>
        <div class="security-card__value">{{ roleText(store.role) }}</div>
        <div class="security-card__meta">
          <span>登录账号</span>
          <strong class="mono">{{ store.phone || '--' }}</strong>
        </div>
        <div class="security-card__meta">
          <span>近 7 日兑换</span>
          <strong>{{ formatNumber(trendTotalLast7) }} 次</strong>
        </div>
        <p>{{ accountScopeText }}</p>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel chart-card">
        <div class="chart-card__header">
          <div>
            <h3>资源类型分布</h3>
            <p>按已发布资源类型统计当前结构</p>
          </div>
        </div>
        <div class="donut-wrap">
          <div class="donut" :style="donutStyle">
            <div class="donut__inner">
              <strong>{{ dashboard.summary.resourceCount }}</strong>
              <span>项资源</span>
            </div>
          </div>
          <ul class="legend-list">
            <li v-for="item in distribution" :key="item.label">
              <span class="legend-list__dot" :style="{ background: item.color }" />
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}%</strong>
            </li>
          </ul>
        </div>
      </article>

      <article class="panel actions-card">
        <div class="chart-card__header">
          <div>
            <h3>快捷动作</h3>
            <p>高频管理入口</p>
          </div>
        </div>
        <button v-for="item in quickLinks" :key="item.path" class="quick-item" @click="router.push(item.path)">
          <span>{{ item.label }}</span>
          <small>进入模块</small>
        </button>
      </article>

      <article class="panel trend-card">
        <div class="chart-card__header">
          <div>
            <h3>近 7 日兑换趋势</h3>
            <p>单位：次</p>
          </div>
          <el-button plain @click="loadData">刷新数据</el-button>
        </div>
        <div class="bars">
          <div v-for="item in weeklyBars" :key="`${item.label}-${item.count}`" class="bars__item">
            <strong class="bars__count">{{ item.count }}</strong>
            <span class="bars__bar" :style="{ height: `${item.height}%` }" />
            <small>{{ item.label }}</small>
          </div>
        </div>
      </article>
    </section>

    <section class="panel table-card">
      <div class="table-card__header">
        <div>
          <h3>最近兑换记录</h3>
          <p>共 {{ dashboard.recentRecords.length }} 条近期授权动态</p>
        </div>
        <span class="action-link" @click="router.push('/redeem-records')">查看全部</span>
      </div>
      <el-table :data="paginatedRecords" empty-text="暂无兑换记录">
        <el-table-column label="资源 ID" min-width="120">
          <template #default="{ row }">
            <span class="mono">{{ row.shareCode || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="resourceName" label="资源名称" min-width="180">
          <template #default="{ row }">
            {{ row.resourceName || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="卡密" min-width="140">
          <template #default="{ row }">
            <span class="mono">{{ row.code || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="分类" min-width="120">
          <template #default="{ row }">
            {{ resourceTypeText(row.resourceType) }}
          </template>
        </el-table-column>
        <el-table-column label="兑换时间" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.redeemedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="授权到期" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.accessExpireAt) }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <RcStatusTag :type="recordStatusType(row.status)" :text="recordStatusText(row.status)" />
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="dashboard.recentRecords.length"
          :page-sizes="[10, 20, 30, 50]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.dashboard-page {
  display: grid;
  gap: 16px;
}

.security-card {
  padding: 18px;
  background: #fff;
  color: var(--rc-text);
  min-height: 120px;
  display: grid;
  gap: 10px;
  border-top: 3px solid var(--rc-primary);

  &__label {
    color: var(--rc-text-soft);
    font-size: 13px;
    font-weight: 500;
  }

  &__value {
    font-size: 30px;
    font-weight: 600;
    line-height: 1.1;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-size: 13px;

    span {
      color: var(--rc-text-soft);
    }

    strong {
      color: var(--rc-text);
    }
  }

  p {
    margin: 0;
    color: var(--rc-text-soft);
    font-size: 12px;
    line-height: 1.7;
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.85fr 1.35fr;
  gap: 16px;
}

.chart-card,
.actions-card,
.trend-card,
.table-card {
  padding: 18px;
}

.chart-card__header,
.table-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  p {
    margin: 4px 0 0;
    color: var(--rc-text-soft);
    font-size: 13px;
  }
}

.donut-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
}

.donut {
  width: 188px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 10px rgba(245, 247, 250, 0.8);

  &__inner {
    width: 110px;
    aspect-ratio: 1;
    border-radius: 50%;
    background: #fff;
    border: 1px solid var(--rc-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    strong {
      font-size: 1.4rem;
    }

    span {
      color: var(--rc-text-soft);
      font-size: 12px;
    }
  }
}

.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
  flex: 1;

  li {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--rc-text-soft);
  }

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
}

.quick-item {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border-radius: 4px;
  border: 1px solid var(--rc-border);
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 10px;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: #c6e2ff;
    color: var(--rc-primary);
    background: var(--rc-primary-soft);
  }

  small {
    color: var(--rc-text-soft);
    font-weight: 400;
  }
}

.bars {
  height: 220px;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
  align-items: end;

  &__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    justify-content: flex-end;
    height: 100%;
  }

  &__count {
    font-size: 13px;
    color: var(--rc-text-soft);
  }

  &__bar {
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, #a0cfff, #409eff);
  }

  small {
    color: var(--rc-text-muted);
  }
}

@media (max-width: 1280px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .donut-wrap {
    flex-direction: column;
  }
}
</style>
