<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { withdrawalApi, type WithdrawalAccountRecord } from '../api/services'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const accounts = ref<WithdrawalAccountRecord[]>([])
const accountType = ref<'alipay' | 'bank'>('alipay')
const form = ref({ name: '', account: '', confirmAccount: '', bankName: '' })

async function loadAccounts() {
  loading.value = true
  try {
    const result = await withdrawalApi.getAccounts()
    accounts.value = (result.data || []).filter((item) => item.status === 'active')
  } finally {
    loading.value = false
  }
}

async function submitAccount() {
  if (!form.value.name || !form.value.account) {
    ElMessage.warning('请填写真实姓名和提现账号')
    return
  }
  if (form.value.account !== form.value.confirmAccount) {
    ElMessage.warning('两次输入的账号不一致')
    return
  }
  if (accountType.value === 'bank' && !form.value.bankName) {
    ElMessage.warning('银行卡提现需填写银行名称')
    return
  }
  saving.value = true
  try {
    await withdrawalApi.createAccount({
      type: accountType.value,
      realName: form.value.name,
      accountNo: form.value.account,
      bankName: form.value.bankName,
    })
    ElMessage.success('提现账户已保存')
    form.value = { name: '', account: '', confirmAccount: '', bankName: '' }
    await loadAccounts()
  } catch (error: any) {
    ElMessage.error(error.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function deleteAccount(id: number) {
  try {
    await withdrawalApi.deleteAccount(id)
    ElMessage.success('账户已停用')
    await loadAccounts()
  } catch (error: any) {
    ElMessage.error(error.error || '操作失败')
  }
}

onMounted(loadAccounts)
</script>

<template>
  <div class="page-shell withdraw-account-page" v-loading="loading">
    <section class="panel account-card">
      <div class="account-card__header">
        <h3>已绑定账户</h3>
        <el-button plain @click="router.push('/withdrawals')">提现记录</el-button>
      </div>
      <div class="account-list" v-if="accounts.length">
        <article v-for="item in accounts" :key="item.id" class="bound-account">
          <div>
            <strong>{{ item.displayName }}</strong>
            <span>{{ item.realName }} · {{ item.type === 'bank' ? item.bankName : '支付宝' }}</span>
          </div>
          <el-button text type="danger" @click="deleteAccount(item.id)">停用</el-button>
        </article>
      </div>
      <el-empty v-else description="暂无提现账户，请先新增" />
    </section>

    <section class="panel account-card">
      <h3>新增提现账户</h3>
      <div class="method-grid">
        <button class="method-card" :class="{ 'is-active': accountType === 'alipay' }" @click="accountType = 'alipay'">
          <strong>支付宝账户</strong>
          <span>快捷到账，操作简便</span>
        </button>
        <button class="method-card" :class="{ 'is-active': accountType === 'bank' }" @click="accountType = 'bank'">
          <strong>银行卡账户</strong>
          <span>支持主流商业银行</span>
        </button>
      </div>

      <div class="form-grid">
        <div class="span-2">
          <label>真实姓名</label>
          <el-input v-model="form.name" placeholder="请填写姓名" />
        </div>
        <div v-if="accountType === 'bank'" class="span-2">
          <label>银行名称</label>
          <el-input v-model="form.bankName" placeholder="例如：招商银行" />
        </div>
        <div>
          <label>{{ accountType === 'alipay' ? '提现账号' : '银行卡号' }}</label>
          <el-input v-model="form.account" placeholder="请输入账号" />
        </div>
        <div>
          <label>确认账号</label>
          <el-input v-model="form.confirmAccount" placeholder="请再次输入以确认" />
        </div>
      </div>

      <div class="notice-card">
        <strong>提现安全须知</strong>
        <ul>
          <li>每位用户最多可绑定 3 个提现账户。</li>
          <li>本地环境仅保存账户信息，不会发起真实打款。</li>
          <li>生产环境建议增加实名校验、短信验证和 24 小时修改冷静期。</li>
          <li>单次提现限额为 ¥100.00 - ¥50,000.00。</li>
        </ul>
      </div>

      <div class="actions">
        <el-button plain @click="router.back()">取消返回</el-button>
        <el-button type="primary" :loading="saving" @click="submitAccount">保存账户</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.withdraw-account-page { display: grid; gap: 16px; }
.account-card {
  padding: 20px;

  h3 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h3 {
      margin-bottom: 0;
    }
  }
}
.account-list { display: grid; gap: 10px; }
.bound-account { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-radius: 4px; border: 1px solid var(--rc-border); background: #fafafa; strong, span { display: block; } span { margin-top: 6px; color: var(--rc-text-soft); } }
.method-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.method-card { height: 80px; border: 1px solid var(--rc-border); border-radius: 4px; background: #fff; text-align: left; padding: 16px; cursor: pointer; strong, span { display: block; } strong { font-weight: 600; } span { margin-top: 6px; color: var(--rc-text-soft); } &.is-active { background: var(--rc-primary-soft); border-color: #c6e2ff; box-shadow: none; } }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 20px; label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 500; } }
.span-2 { grid-column: span 2; }
.notice-card { margin-top: 20px; padding: 16px; border-radius: 4px; background: #f0f9eb; border: 1px solid #d9ecb5; ul { margin: 10px 0 0; padding-left: 18px; color: var(--rc-text-soft); line-height: 1.8; } }
.actions { margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 860px) { .method-grid, .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: span 1; } }
</style>
