<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { adminUsersApi, type AdminUserRecord } from '../api/services'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { useServerPagination } from '../composables/useServerPagination'
import { formatDate } from '../utils/utils'

const loading = ref(false)
const detailLoading = ref(false)
const keyword = ref('')
const role = ref('')
const rows = ref<AdminUserRecord[]>([])
const detailVisible = ref(false)
const currentDetail = ref<AdminUserRecord | null>(null)
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse, resetPage } = pagination

function roleText(value?: string) {
  return value === 'admin' ? '超级管理员' : '用户'
}

function roleTagType(value?: string) {
  return value === 'admin' ? 'success' : 'info'
}

function buildQueryParams(page = currentPage.value) {
  return {
    ...buildPaginationParams(page),
    keyword: keyword.value.trim() || undefined,
    role: role.value || undefined,
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

async function openDetail(row: AdminUserRecord) {
  detailVisible.value = true
  currentDetail.value = row
  detailLoading.value = true
  try {
    currentDetail.value = await adminUsersApi.getUser(row.id)
  } catch (error: any) {
    ElMessage.error(error.error || '获取用户详情失败')
  } finally {
    detailLoading.value = false
  }
}

function applyFilters() {
  resetPage()
  void loadRows(1)
}

function resetFilters() {
  keyword.value = ''
  role.value = ''
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
    <section class="panel filter-panel">
      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索用户名、昵称、联系方式" @keyup.enter="applyFilters" />
        <el-select v-model="role" placeholder="全部角色" clearable>
          <el-option label="超级管理员" value="admin" />
          <el-option label="用户" value="user" />
        </el-select>
        <el-button type="primary" @click="applyFilters">查询</el-button>
        <el-button plain @click="resetFilters">重置</el-button>
      </div>
    </section>

    <section class="panel table-card">
      <el-table :data="rows" empty-text="暂无用户记录" table-layout="fixed" style="width: 100%;">
        <el-table-column label="ID" width="90">
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
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
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

    <el-dialog v-model="detailVisible" title="用户详情" width="560px">
      <div v-loading="detailLoading" class="detail-grid">
        <template v-if="currentDetail">
          <span>ID</span>
          <strong class="mono">{{ currentDetail.id }}</strong>
          <span>用户名</span>
          <strong class="mono">{{ currentDetail.username || '--' }}</strong>
          <span>手机号</span>
          <strong>{{ currentDetail.phone || '--' }}</strong>
          <span>昵称</span>
          <strong>{{ currentDetail.nickname || '--' }}</strong>
          <span>联系方式</span>
          <strong>{{ currentDetail.contact || '--' }}</strong>
          <span>角色</span>
          <strong>{{ roleText(currentDetail.role) }}</strong>
          <span>最后登录</span>
          <strong>{{ formatDate(currentDetail.lastLogin) || '--' }}</strong>
          <span>注册时间</span>
          <strong>{{ formatDate(currentDetail.createdAt) || '--' }}</strong>
          <span>更新时间</span>
          <strong>{{ formatDate(currentDetail.updatedAt) || '--' }}</strong>
        </template>
      </div>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
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
  grid-template-columns: minmax(280px, 460px) 180px auto auto;
  gap: 14px;
  align-items: center;
}

.detail-grid {
  min-height: 240px;
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px 18px;
  align-items: center;

  span {
    color: var(--rc-text-soft);
    font-size: 13px;
  }

  strong {
    min-width: 0;
    color: var(--rc-text);
    font-size: 14px;
    font-weight: 600;
    word-break: break-all;
  }
}

@media (max-width: 960px) {
  .filter-row {
    grid-template-columns: 1fr;
  }

  .table-card :deep(.el-table) {
    min-width: 1120px;
  }
}
</style>
