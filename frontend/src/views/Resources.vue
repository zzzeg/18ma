<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { shareApi, type ShareRecord } from '../api/services'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { useServerPagination } from '../composables/useServerPagination'
import { copyToClipboard, formatDate, formatFileSize, generateShareLink } from '../utils/utils'

const router = useRouter()
const loading = ref(false)
const keyword = ref('')
const currentStatus = ref('')
const rows = ref<ShareRecord[]>([])
const dateEquals = ref<[Date, Date] | null>(null)
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse, resetPage } = pagination

function resourceTypeText(type?: string) {
  return ({ file: '文件', cloud: '网盘', url: '链接', text: '文本信息' } as Record<string, string>)[type || ''] || type || '文件'
}

const displayRows = computed(() =>
  rows.value.map((item) => ({
    id: item.shareCode,
    name: item.fileName,
    typeValue: resourceTypeText(item.resourceType || item.fileType),
    status: '已启用',
    size: formatFileSize(item.fileSize),
    createdAt: item.createdAt ? formatDate(item.createdAt, 'yyyy-MM-dd') : '--',
  })),
)

function buildQueryParams(page = currentPage.value) {
  return {
    ...buildPaginationParams(page),
    keyword: keyword.value.trim(),
    startDate: dateEquals.value?.[0] ? formatDate(dateEquals.value[0], 'yyyy-MM-dd') : '',
    endDate: dateEquals.value?.[1] ? formatDate(dateEquals.value[1], 'yyyy-MM-dd') : '',
  }
}

async function loadRows(page = currentPage.value) {
  loading.value = true
  try {
    const result = await shareApi.getMyShares(buildQueryParams(page))
    rows.value = result.data || []
    syncFromResponse(result, page)
  } catch {
    rows.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function handleDelete(code: string) {
  try {
    await shareApi.deleteShare(code)
    ElMessage.success('资源已删除')
    await loadRows(currentPage.value)
  } catch (error: any) {
    ElMessage.error(error.error || '删除失败')
  }
}

async function handleCopyShareLink(code: string) {
  await copyToClipboard(generateShareLink(code))
  ElMessage.success('分享链接已复制到粘贴板~')
}

function applyFilters() {
  resetPage()
  void loadRows(1)
}

function resetFilters() {
  keyword.value = ''
  currentStatus.value = ''
  dateEquals.value = null
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
  <div class="page-shell resources-page" v-loading="loading">
    <section class="panel resources-filter">
      <el-form :inline="true" class="filter-row">
        <el-form-item class="order-toolbar__keyword">
          <el-input v-model="keyword" placeholder="输入资源名称或分享码" @keyup.enter="applyFilters" />
        </el-form-item>
        <el-form-item class="order-toolbar__status">
          <el-select v-model="currentStatus" placeholder="全部状态" clearable>
            <el-option label="已启用" value="已启用" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-date-picker v-model="dateEquals" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button plain @click="resetFilters">重置</el-button>
          <el-button type="primary" @click="router.push('/upload')">发布资源</el-button>
        </el-form-item>

      </el-form>
    </section>

    <section class="panel resources-table">
      <el-table :data="displayRows" empty-text="暂无资源记录">
        <el-table-column label="资源 ID" width="140">
          <template #default="{ row }">
            <span class="mono">{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column label="资源名称" min-width="220">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-cell__dot" />
              <div>
                <strong>{{ row.name }}</strong>
                <small>{{ row.createdAt }}</small>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="typeValue" label="类型" width="120" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <RcStatusTag type="success" :text="row.status" />
          </template>
        </el-table-column>
        <el-table-column prop="size" label="文件体积" width="120" />
        <el-table-column label="操作" min-width="210">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button text type="success" @click="handleCopyShareLink(row.id)">分享链接</el-button>
              <el-button text type="primary" @click="router.push(`/upload?code=${row.id}`)">编辑</el-button>
              <el-button text type="danger" @click="handleDelete(row.id)">删除</el-button>
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
.resources-page {
  display: grid;
  gap: 18px;
}

.resources-filter,
.resources-table {
  padding: 22px;
}

.filter-row {
  display: grid;
  grid-template-columns: minmax(220px, 360px) 120px 300px minmax(250px, auto);
  gap: 14px;

  :deep(.el-form-item) {
    margin-bottom: 0;
  }


}

.resources-table {
  overflow-x: auto;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;

  &__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #0e67af;
  }

  strong,
  small {
    display: block;
  }

  small {
    color: var(--rc-text-soft);
    margin-top: 4px;
  }
}

.table-actions {
  white-space: nowrap;
}

@media (max-width: 1080px) {
  .filter-row {
    grid-template-columns: 1fr 1fr;
  }

  .resources-table :deep(.el-table) {
    min-width: 920px;
  }
}
</style>
