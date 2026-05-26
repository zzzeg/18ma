<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { walletApi, withdrawalApi, type WalletSummary, type WithdrawalAccountRecord, type WithdrawalRecord } from '../api/services'
import { formatCurrency, formatDate } from '../utils/utils'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const amount = ref(0)
const accountId = ref<number | null>(null)
const accounts = ref<WithdrawalAccountRecord[]>([])
const recentRows = ref<WithdrawalRecord[]>([])
const summary = ref<WalletSummary>({ availableBalance: 0, frozenAmount: 0, withdrawnAmount: 0, totalEarnings: 0, pendingWithdrawalAmount: 0, withdrawalCount: 0 })
const selectedAccount = computed(() => accounts.value.find((item) => item.id === accountId.value))

async function loadData() {
  loading.value = true
  try {
    const [summaryRes, accountRes, withdrawalRes] = await Promise.all([
      walletApi.getSummary(),
      withdrawalApi.getAccounts(),
      withdrawalApi.getWithdrawals(),
    ])
    summary.value = summaryRes
    accounts.value = (accountRes.data || []).filter((item) => item.status === 'active')
    recentRows.value = (withdrawalRes.data || []).slice(0, 3)
    if (!accountId.value && accounts.value.length) accountId.value = accounts.value[0].id
  } finally {
    loading.value = false
  }
}

async function submitWithdrawal() {
  if (!accountId.value) {
    ElMessage.warning('请先选择或新增提现账户')
    return
  }
  if (amount.value < 100) {
    ElMessage.warning('单笔提现最低金额为 ¥100.00')
    return
  }
  if (amount.value > summary.value.availableBalance) {
    ElMessage.warning('可提现余额不足')
    return
  }
  submitting.value = true
  try {
    await withdrawalApi.createWithdrawal({ accountId: accountId.value, amount: amount.value })
    ElMessage.success('提现申请已提交')
    await router.push('/withdrawals')
  } catch (error: any) {
    ElMessage.error(error.error || '提现申请失败')
  } finally {
    submitting.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-shell withdraw-apply-page" v-loading="loading">
    <section class="apply-layout">
      <div class="apply-main">
        <article class="panel amount-card">
          <small>提现金额 (CNY)</small>
          <el-input-number v-model="amount" :min="0" :max="50000" :precision="2" :step="100" />
          <div class="amount-card__meta">
            <span>单笔最小提现金额：¥100.00</span>
            <span>当前可提现：{{ formatCurrency(summary.availableBalance) }}</span>
          </div>
        </article>

        <article class="panel accounts-card">
          <div class="accounts-card__header">
            <h3>收款账户</h3>
            <span class="action-link" @click="router.push('/withdraw-account')">管理账户</span>
          </div>
          <div v-if="accounts.length" class="account-grid">
            <button v-for="item in accounts" :key="item.id" class="account-item" :class="{ 'is-active': accountId === item.id }" @click="accountId = item.id">
              <strong>{{ item.type === 'bank' ? item.bankName || '银行卡' : '支付宝' }}</strong>
              <span>{{ item.maskedAccount }}</span>
            </button>
          </div>
          <el-empty v-else description="暂无可用提现账户">
            <el-button type="primary" @click="router.push('/withdraw-account')">新增提现账户</el-button>
          </el-empty>
        </article>

        <div class="helper-grid">
          <article class="panel helper-box">
            <h3>提现须知</h3>
            <ul>
              <li>工作日提现 T+1 到账，节假日顺延至下一个工作日。</li>
              <li>提现手续费为 0.1%，由收款通道方扣除。</li>
              <li>本地环境仅创建审核记录，不会真实打款。</li>
            </ul>
          </article>
          <article class="panel helper-box">
            <h3>本次申请</h3>
            <p>当前选择：{{ selectedAccount?.displayName || '未选择账户' }}</p>
          </article>
        </div>

        <el-button class="submit-btn" type="primary" :loading="submitting" @click="submitWithdrawal">确认申请提现</el-button>
      </div>

      <aside class="apply-side">
        <article class="panel wallet-card">
          <small>当前可用余额</small>
          <strong>{{ formatCurrency(summary.availableBalance) }}</strong>
          <div class="wallet-card__meta">
            <div><span>累计已提现</span><strong>{{ formatCurrency(summary.withdrawnAmount) }}</strong></div>
            <div><span>冻结中资金</span><strong>{{ formatCurrency(summary.frozenAmount) }}</strong></div>
          </div>
        </article>

        <article class="panel history-card">
          <div class="history-card__header">
            <h3>近期提现记录</h3>
            <span class="action-link" @click="router.push('/withdrawals')">查看全部</span>
          </div>
          <div v-for="row in recentRows" :key="row.id" class="history-item">
            <strong>{{ row.account }}</strong>
            <span>-{{ formatCurrency(row.amount) }}</span>
            <small>{{ formatDate(row.time) }} / {{ row.status }}</small>
          </div>
          <el-empty v-if="!recentRows.length" description="暂无提现记录" />
        </article>
      </aside>
    </section>
  </div>
</template>

<style scoped lang="scss">
.withdraw-apply-page { display: grid; gap: 16px; }
.apply-layout { display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 16px; }
.apply-main, .apply-side, .helper-grid { display: grid; gap: 16px; }
.amount-card, .accounts-card, .helper-box, .wallet-card, .history-card { padding: 18px; }
.amount-card { small { color: var(--rc-text-soft); } :deep(.el-input-number) { margin-top: 14px; width: 100%; } &__meta { display: flex; justify-content: space-between; gap: 16px; margin-top: 12px; color: var(--rc-text-soft); font-size: 12px; } }
.accounts-card__header, .history-card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; h3 { margin: 0; font-size: 16px; font-weight: 600; } }
.action-link { color: var(--rc-primary); cursor: pointer; font-weight: 500; }
.account-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.account-item { height: 84px; border: 1px solid var(--rc-border); border-radius: 4px; background: #fff; padding: 16px; text-align: left; cursor: pointer; strong, span { display: block; } strong { font-weight: 600; } span { margin-top: 8px; color: var(--rc-text-soft); } &.is-active { border-color: #c6e2ff; background: var(--rc-primary-soft); box-shadow: none; } }
.helper-grid { grid-template-columns: repeat(2, 1fr); }
.helper-box { ul { margin: 10px 0 0; padding-left: 18px; color: var(--rc-text-soft); line-height: 1.8; } p { margin: 10px 0 0; color: var(--rc-text-soft); } }
.submit-btn { height: 40px; border-radius: 4px; }
.wallet-card { background: linear-gradient(135deg, #409eff, #66b1ff); color: #fff; small { color: rgba(255, 255, 255, 0.76); } strong { display: block; margin-top: 14px; font-size: 32px; letter-spacing: -0.03em; font-weight: 600; } &__meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 18px; span { display: block; color: rgba(255, 255, 255, 0.74); font-size: 12px; } strong { margin-top: 6px; font-size: 16px; } } }
.history-item { padding: 12px 0; border-bottom: 1px solid var(--rc-border); &:last-child { border-bottom: none; } strong, span, small { display: block; } span { margin-top: 8px; font-size: 18px; font-weight: 600; } small { margin-top: 8px; color: var(--rc-text-soft); } }
@media (max-width: 1100px) { .apply-layout, .helper-grid, .account-grid { grid-template-columns: 1fr; } }
</style>
