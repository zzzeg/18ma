<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { adminUsersApi, type AdminUserRecord, type AdminUserUpdatePayload, type UserStatus } from '../api/services'
import { formatDate, validateUsername } from '../utils/utils'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const user = ref<AdminUserRecord | null>(null)
const form = ref({
  username: '',
  phone: '',
  nickname: '',
  contact: '',
  role: 'user' as 'user' | 'admin',
  status: 'active' as UserStatus,
})

const userId = computed(() => Number(route.params.id || 0))

function syncForm(record: AdminUserRecord) {
  form.value = {
    username: record.username || '',
    phone: record.phone || '',
    nickname: record.nickname || '',
    contact: record.contact || '',
    role: record.role || 'user',
    status: record.status || 'active',
  }
}

async function loadUser() {
  if (!userId.value) {
    ElMessage.error('用户 ID 无效')
    router.replace('/users')
    return
  }

  loading.value = true
  try {
    const result = await adminUsersApi.getUser(userId.value)
    user.value = result
    syncForm(result)
  } catch (error: any) {
    ElMessage.error(error.error || '获取用户详情失败')
    router.replace('/users')
  } finally {
    loading.value = false
  }
}

async function saveUser() {
  if (!validateUsername(form.value.username)) {
    ElMessage.warning('用户名需为 4-20 位字母、数字或下划线')
    return
  }

  const payload: AdminUserUpdatePayload = {
    username: form.value.username.trim(),
    phone: form.value.phone.trim() || null,
    nickname: form.value.nickname.trim(),
    contact: form.value.contact.trim(),
    role: form.value.role,
    status: form.value.status,
  }

  saving.value = true
  try {
    const result = await adminUsersApi.updateUser(userId.value, payload)
    user.value = result
    syncForm(result)
    ElMessage.success('用户信息已保存')
  } catch (error: any) {
    ElMessage.error(error.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function resetPassword() {
  if (!user.value) return
  try {
    const result = await ElMessageBox.prompt('请输入新密码，至少 6 位', `重置密码：${user.value.username}`, {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码至少 6 位',
    })
    await adminUsersApi.resetPassword(user.value.id, result.value)
    ElMessage.success('密码已重置')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.error || '重置密码失败')
  }
}

async function deleteUser() {
  if (!user.value) return
  try {
    await ElMessageBox.confirm(`确定删除用户 ${user.value.username}？该操作不可恢复。`, '删除用户', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await adminUsersApi.deleteUser(user.value.id)
    ElMessage.success('用户已删除')
    router.replace('/users')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.error || '删除失败')
  }
}

async function approveCancellation() {
  if (!user.value) return
  try {
    const result = await adminUsersApi.updateUser(user.value.id, { status: 'cancelled' })
    user.value = result
    syncForm(result)
    ElMessage.success('注销申请已通过')
  } catch (error: any) {
    ElMessage.error(error.error || '操作失败')
  }
}

async function rejectCancellation() {
  if (!user.value) return
  try {
    const result = await adminUsersApi.updateUser(user.value.id, { status: 'active' })
    user.value = result
    syncForm(result)
    ElMessage.success('注销申请已驳回')
  } catch (error: any) {
    ElMessage.error(error.error || '操作失败')
  }
}

onMounted(() => {
  void loadUser()
})
</script>

<template>
  <div class="page-shell user-detail-page" v-loading="loading">
    <section class="panel detail-panel">
      <div class="detail-header">
        <div>
          <h2>用户详情</h2>
          <p class="muted">查看和编辑注册用户信息</p>
        </div>
        <div class="detail-header__actions">
          <el-button plain @click="router.push('/users')">返回列表</el-button>
          <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
        </div>
      </div>

      <el-form class="detail-form" label-position="top">
        <el-form-item label="ID">
          <el-input :model-value="user?.id || '--'" disabled />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="可选" />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="form.contact" placeholder="请输入联系方式" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role">
            <el-option label="超级管理员" value="admin" />
            <el-option label="用户" value="user" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="已启用" value="active" />
            <el-option label="已停用" value="disabled" />
            <el-option label="待注销审核" value="cancellation_pending" />
            <el-option label="已注销" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="注销申请时间">
          <el-input :model-value="formatDate(user?.cancellationRequestedAt) || '--'" disabled />
        </el-form-item>
        <el-form-item label="注销时间">
          <el-input :model-value="formatDate(user?.cancelledAt) || '--'" disabled />
        </el-form-item>
        <el-form-item label="最后登录">
          <el-input :model-value="formatDate(user?.lastLogin) || '--'" disabled />
        </el-form-item>
        <el-form-item label="注册时间">
          <el-input :model-value="formatDate(user?.createdAt) || '--'" disabled />
        </el-form-item>
        <el-form-item label="更新时间">
          <el-input :model-value="formatDate(user?.updatedAt) || '--'" disabled />
        </el-form-item>
      </el-form>

      <div class="danger-zone">
        <div>
          <strong>账户操作</strong>
          <p>重置密码或删除用户会立即生效。</p>
        </div>
        <div class="danger-zone__actions">
          <template v-if="user?.status === 'cancellation_pending'">
            <el-button type="success" plain @click="approveCancellation">通过注销</el-button>
            <el-button plain @click="rejectCancellation">驳回注销</el-button>
          </template>
          <el-button plain @click="resetPassword">重置密码</el-button>
          <el-button type="danger" plain @click="deleteUser">删除用户</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.user-detail-page {
  display: grid;
  gap: 18px;
}

.detail-panel {
  padding: 22px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  &__actions {
    display: flex;
    gap: 10px;
  }
}

.detail-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
  max-width: 860px;
}

.danger-zone {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--rc-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  strong {
    display: block;
    font-size: 15px;
  }

  p {
    margin: 6px 0 0;
    color: var(--rc-text-soft);
  }

  &__actions {
    display: flex;
    gap: 10px;
  }
}

@media (max-width: 960px) {
  .detail-header,
  .danger-zone {
    flex-direction: column;
  }

  .detail-form {
    grid-template-columns: 1fr;
  }
}
</style>
