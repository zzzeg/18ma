<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { adminUsersApi, type AdminUserRecord, type UserStatus } from '../api/services'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { useServerPagination } from '../composables/useServerPagination'
import { formatDate } from '../utils/utils'

const router = useRouter()
const loading = ref(false)
const keyword = ref('')
const role = ref('')
const status = ref('')
const rows = ref<AdminUserRecord[]>([])
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse, resetPage } = pagination

function roleText(value?: string) {
  return value === 'admin' ? '超级管理员' : '用户'
}

function roleTagType(value?: string) {
  return value === 'admin' ? 'success' : 'info'
}

function statusText(value?: string) {
  return ({
    active: '已启用',
    disabled: '已停用',
    cancellation_pending: '待注销审核',
    cancelled: '已注销',
  } as Record<string, string>)[value || ''] || '已启用'
}

function statusTagType(value?: string) {
  return ({
    active: 'success',
    disabled: 'warning',
    cancellation_pending: 'primary',
    cancelled: 'info',
  } as Record<string, 'success' | 'warning' | 'primary' | 'info'>)[value || ''] || 'success'
}

function buildQueryParams(page = currentPage.value) {
  return {
    ...buildPaginationParams(page),
    keyword: keyword.value.trim() || undefined,
    role: role.value || undefined,
    status: status.value || undefined,
  }
}

async function loadRows(page = currentPage.value) {
  loading.value = true
  try {
    const result = await adminUsersApi.getUsers(buildQueryParams(page))
    rows.value = result.data || []
    syncFromResponse(result, page)
  } catch (error: any) {
    rows.value = []
    total.value = 0
    ElMessage.error(error.error || '获取用户列表失败')
  } finally {
    loading.value = false
  }
}

function openDetail(row: AdminUserRecord) {
  router.push(`/users/${row.id}`)
}

async function toggleStatus(row: AdminUserRecord) {
  const nextStatus = row.status === 'disabled' ? 'active' : 'disabled'
  try {
    await adminUsersApi.updateUser(row.id, { status: nextStatus })
    ElMessage.success(nextStatus === 'active' ? '用户已启用' : '用户已停用')
    await loadRows(currentPage.value)
  } catch (error: any) {
    ElMessage.error(error.error || '操作失败')
  }
}

async function updateStatus(row: AdminUserRecord, nextStatus: UserStatus, message: string) {
  try {
    await adminUsersApi.updateUser(row.id, { status: nextStatus })
    ElMessage.success(message)
    await loadRows(currentPage.value)
  } catch (error: any) {
    ElMessage.error(error.error || '操作失败')
  }
}

function canToggleStatus(row: AdminUserRecord) {
  return row.status === 'active' || row.status === 'disabled'
}

async function changeRole(row: AdminUserRecord, nextRole: 'user' | 'admin') {
  try {
    await adminUsersApi.updateUser(row.id, { role: nextRole })
    ElMessage.success('角色已更新')
    await loadRows(currentPage.value)
  } catch (error: any) {
    ElMessage.error(error.error || '角色更新失败')
  }
}

function handleRoleCommand(row: AdminUserRecord, command: unknown) {
  if (command === 'admin' || command === 'user') {
    void changeRole(row, command)
  }
}

async function resetPassword(row: AdminUserRecord) {
  try {
    const result = await ElMessageBox.prompt('请输入新密码，至少 6 位', `重置密码：${row.username}`, {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputType: 'password',
      inputPattern: /^.{6,}$/,
      inputErrorMessage: '密码至少 6 位',
    })
    await adminUsersApi.resetPassword(row.id, result.value)
    ElMessage.success('密码已重置')
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.error || '重置密码失败')
  }
}

async function deleteUser(row: AdminUserRecord) {
  try {
    await ElMessageBox.confirm(`确定删除用户 ${row.username}？该操作不可恢复。`, '删除用户', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await adminUsersApi.deleteUser(row.id)
    ElMessage.success('用户已删除')
    await loadRows(currentPage.value)
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.error || '删除失败')
  }
}

function applyFilters() {
  resetPage()
  void loadRows(1)
}

function resetFilters() {
  keyword.value = ''
  role.value = ''
  status.value = ''
  resetPage()
  void loadRows(1)
}

function handleSizeChange(value: number) {
  void pagination.handleSizeChange(value, loadRows)
}

function handleCurrentChange(value: number) {
  void pagination.handleCurrentChange(value, loadRows)
}

onMounted(() => {
  void loadRows()
})
</script>

<template>
  <div class="page-shell users-page" v-loading="loading">
    <section class="panel filter-panel" style="padding-bottom:4px">
      <el-form inline class="filter-row">
        <el-form-item>
          <el-input v-model="keyword" placeholder="搜索用户名、昵称、联系方式" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item>
          <el-select v-model="role" placeholder="全部角色" clearable>
            <el-option label="超级管理员" value="admin" />
            <el-option label="用户" value="user" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="status" placeholder="全部状态" clearable>
            <el-option label="已启用" value="active" />
            <el-option label="已停用" value="disabled" />
            <el-option label="待注销审核" value="cancellation_pending" />
            <el-option label="已注销" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">应用</el-button>
          <el-button plain @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="panel table-card">
      <el-table :data="rows" empty-text="暂无用户记录" table-layout="fixed" style="width: 100%;">
        <el-table-column label="ID" width="80">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户名" min-width="150">
          <template #default="{ row }">
            <span class="mono">{{ row.username || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="昵称" min-width="150">
          <template #default="{ row }">
            {{ row.nickname || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="联系方式" min-width="170">
          <template #default="{ row }">
            {{ row.contact || row.phone || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="角色" width="130">
          <template #default="{ row }">
            <RcStatusTag :type="roleTagType(row.role)" :text="roleText(row.role)" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <RcStatusTag :type="statusTagType(row.status)" :text="statusText(row.status)" />
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="最后登录" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.lastLogin) || '--' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="330" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="primary" @click="openDetail(row)">详情/编辑</el-button>
              <el-button v-if="canToggleStatus(row)" text type="warning" @click="toggleStatus(row)">
                {{ row.status === 'disabled' ? '启用' : '停用' }}
              </el-button>
              <template v-if="row.status === 'cancellation_pending'">
                <el-button text type="success" @click="updateStatus(row, 'cancelled', '注销申请已通过')">通过注销</el-button>
                <el-button text type="primary" @click="updateStatus(row, 'active', '注销申请已驳回')">驳回</el-button>
              </template>
              <el-dropdown trigger="click" @command="(command: unknown) => handleRoleCommand(row, command)">
                <el-button text type="primary">改角色</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="admin">超级管理员</el-dropdown-item>
                    <el-dropdown-item command="user">用户</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button text type="primary" @click="resetPassword(row)">重置密码</el-button>
              <el-button text type="danger" @click="deleteUser(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper" :total="total" :page-sizes="[10, 20, 30, 50]"
          @size-change="handleSizeChange" @current-change="handleCurrentChange" />
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.users-page {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.filter-panel,
.table-card {
  padding: 22px;
}

.table-card {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(220px, 360px) 180px 180px auto;
  gap: 14px;
  align-items: center;
}

.table-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .filter-row {
    grid-template-columns: 1fr;
  }

  .table-card :deep(.el-table) {
    min-width: 1280px;
  }
}
</style>
