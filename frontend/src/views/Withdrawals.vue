<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { walletApi, withdrawalApi, type WalletSummary, type WithdrawalRecord } from '../api/services'
import { useServerPagination } from '../composables/useServerPagination'
import { formatCurrency, formatDate } from '../utils/utils'

const router = useRouter()
const loading = ref(false)
const rows = ref<WithdrawalRecord[]>([])
const summary = ref<WalletSummary>({ availableBalance: 0, frozenAmount: 0, withdrawnAmount: 0, totalEarnings: 0, pendingWithdrawalAmount: 0, withdrawalCount: 0 })
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse } = pagination

function handleSizeChange(value: number) {
  void pagination.handleSizeChange(value, loadData)
}

function handleCurrentChange(value: number) {
  void pagination.handleCurrentChange(value, loadData)
}

const paidCount = computed(() => summary.value.paidWithdrawalCount ?? rows.value.filter((row) => row.rawStatus === 'paid').length)

async function loadData(page = currentPage.value) {
  loading.value = true
  try {
    const [summaryRes, withdrawalRes] = await Promise.all([
      walletApi.getSummary(),
      withdrawalApi.getWithdrawals(buildPaginationParams(page)),
    ])
    summary.value = summaryRes
    rows.value = withdrawalRes.data || []
    syncFromResponse(withdrawalRes, page)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-shell withdrawals-page" v-loading="loading">
    <section class="summary-grid">
      <article class="panel summary-box"><small>当前可提现余额</small><strong>{{ formatCurrency(summary.availableBalance) }}</strong><span>冻结金额 {{ formatCurrency(summary.frozenAmount) }}</span></article>
      <article class="panel summary-box"><small>累计已提现金额</small><strong>{{ formatCurrency(summary.withdrawnAmount) }}</strong></article>
      <article class="panel summary-box"><small>提现成功次数</small><strong>{{ paidCount }} 次</strong></article>
    </section>

    <section class="panel table-card">
      <div class="toolbar">
        <el-button plain @click="router.push('/withdraw-account')">提现账户</el-button>
        <el-button type="primary" @click="router.push('/withdraw-apply')">申请提现</el-button>
        <el-button plain @click="loadData">刷新</el-button>
      </div>

      <el-table :data="rows" empty-text="暂无提现记录">
        <el-table-column label="流水号" min-width="170">
          <template #default="{ row }">
            <span class="mono">{{ row.withdrawalNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.time) }}
          </template>
        </el-table-column>
        <el-table-column label="提现金额" min-width="120">
          <template #default="{ row }">
            {{ formatCurrency(row.amount) }}
          </template>
        </el-table-column>
        <el-table-column label="手续费" min-width="120">
          <template #default="{ row }">
            {{ formatCurrency(row.fee) }}
          </template>
        </el-table-column>
        <el-table-column prop="account" label="收款账户" min-width="200" />
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <RcStatusTag :type="row.rawStatus === 'paid' ? 'success' : row.rawStatus === 'pending' ? 'primary' : 'error'" :text="row.status" />
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-sizes="[10, 20, 30, 50]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </section>

    <section class="panel notice-box">
      <strong>提现须知</strong>
      <ol>
        <li>提现申请将在 1-3 个工作日内完成审核。</li>
        <li>单笔提现最低金额为 ¥100.00，最高为 ¥50,000.00。</li>
        <li>本地环境不会发起真实打款，提交后默认进入“审核中”。</li>
      </ol>
    </section>
  </div>
</template>

<style scoped lang="scss">
.withdrawals-page { display: grid; gap: 18px; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.summary-box, .table-card, .notice-box { padding: 22px; }
.summary-box { small { color: var(--rc-text-soft); } strong { display: block; margin-top: 14px; font-size: 2rem; } span { display: block; margin-top: 10px; color: var(--rc-text-soft); } }
.toolbar { display: flex; justify-content: flex-end; margin-bottom: 18px; }
.notice-box { background: #f5f7fd; ol { margin: 14px 0 0; padding-left: 18px; color: var(--rc-text-soft); line-height: 1.8; } }
@media (max-width: 960px) { .summary-grid { grid-template-columns: 1fr; } .table-card { overflow-x: auto; } .table-card :deep(.el-table) { min-width: 860px; } }
</style>
