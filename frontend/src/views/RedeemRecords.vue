<script setup lang="ts">
import { onMounted, ref } from 'vue'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { redeemApi, type RedeemRecordRow } from '../api/services'
import { useServerPagination } from '../composables/useServerPagination'
import { formatDate } from '../utils/utils'

const loading = ref(false)
const keyword = ref('')
const currentStatus = ref('')
const rows = ref<RedeemRecordRow[]>([])
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse, resetPage } = pagination

function resourceTypeText(type: RedeemRecordRow['resourceType']) {
  return ({ file: '文件', cloud: '网盘', url: '链接', text: '文本信息' })[type] || type
}

function handleSizeChange(value: number) {
  void pagination.handleSizeChange(value, loadRows)
}

function handleCurrentChange(value: number) {
  void pagination.handleCurrentChange(value, loadRows)
}

async function loadRows(page = currentPage.value) {
  loading.value = true
  try {
    const result = await redeemApi.getRecords({
      ...buildPaginationParams(page),
      keyword: keyword.value.trim() || undefined,
      status: currentStatus.value || undefined,
    })
    rows.value = result.data || []
    syncFromResponse(result, page)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  resetPage()
  void loadRows(1)
}

onMounted(loadRows)
</script>

<template>
  <div class="page-shell records-page" v-loading="loading">
    <section class="panel filter-panel">
      <div class="filter-row">
        <el-input v-model="keyword" placeholder="搜索资源名、资源 ID 或卡密" @keyup.enter="applyFilters" />
        <el-select v-model="currentStatus" placeholder="全部状态" clearable>
          <el-option label="有效" value="active" />
          <el-option label="已过期" value="expired" />
          <el-option label="已撤销" value="revoked" />
        </el-select>
        <el-button plain @click="applyFilters">查询</el-button>
      </div>
    </section>

    <section class="panel table-card">
      <el-table :data="rows" empty-text="暂无兑换记录" table-layout="fixed" style="width: 100%;">
        <el-table-column label="资源 ID" min-width="120">
          <template #default="{ row }">
            <span class="mono">{{ row.shareCode || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="卡密" min-width="140">
          <template #default="{ row }">
            <span class="mono">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="resourceName" label="资源名称" min-width="180" />
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
            <RcStatusTag
              :type="row.status === 'active' ? 'success' : row.status === 'expired' ? 'warning' : 'info'"
              :text="row.status === 'active' ? '有效' : row.status === 'expired' ? '已过期' : '已撤销'"
            />
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
  </div>
</template>

<style scoped lang="scss">
.records-page {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.records-page > * {
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

.table-card :deep(.el-table) {
  min-width: 0;
  width: 100%;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(320px, 460px) 180px auto;
  gap: 14px;
}

@media (max-width: 960px) {
  .filter-row {
    grid-template-columns: 1fr;
  }

  .table-card {
    overflow-x: auto;
  }

  .table-card :deep(.el-table) {
    min-width: 1080px;
  }
}
</style>
