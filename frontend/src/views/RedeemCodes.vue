<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, TableInstance } from 'element-plus'
import RcStatusTag from '../components/rc/RcStatusTag.vue'
import { redeemApi, type RedeemCodeRecord, type RedeemResourceOption } from '../api/services'
import { useServerPagination } from '../composables/useServerPagination'
import { redeemDurationOptions, formatRedeemDuration } from '../config/redeem'
import { downloadBlobFile, formatDate } from '../utils/utils'

const loading = ref(false)
const importSubmitting = ref(false)
const generateSubmitting = ref(false)
const importDialogVisible = ref(false)
const generateDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const keyword = ref('')
const currentStatus = ref('')
const rows = ref<RedeemCodeRecord[]>([])
const resources = ref<RedeemResourceOption[]>([])
const fileInputKey = ref(0)
const generateFormRef = ref<FormInstance>()
const tableRef = ref<TableInstance>()
const pagination = useServerPagination()
const { currentPage, pageSize, total, buildPaginationParams, syncFromResponse, resetPage } = pagination
const importForm = ref({
  resourceId: undefined as number | undefined,
  content: '',
})
const generateForm = ref({
  resourceId: undefined as number | undefined,
  durationCode: redeemDurationOptions[0]?.value || '1h',
  count: '',
  remark: '',
})
const importFile = ref<File | null>(null)
const exportScope = ref<'selected' | 'page' | 'all'>('selected')
const selectedRowState = ref<Record<string, RedeemCodeRecord>>({})

const durationCodesText = computed(() => redeemDurationOptions.map((item) => item.value).join('、'))
const selectedRows = computed(() => Object.values(selectedRowState.value))

const generateRules: FormRules = {
  resourceId: [
    { required: true, message: '请选择资源', trigger: 'change' },
  ],
  durationCode: [
    { required: true, message: '请选择时长', trigger: 'change' },
  ],
  count: [
    { required: true, message: '请输入生成条数', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        const normalized = String(value || '').trim()
        if (!normalized) {
          callback(new Error('请输入生成条数'))
          return
        }
        if (!/^\d+$/.test(normalized)) {
          callback(new Error('生成条数必须是数字'))
          return
        }
        const count = Number(normalized)
        if (count < 1 || count > 500) {
          callback(new Error('生成条数仅支持 1 到 500'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
  remark: [
    { max: 100, message: '备注不能超过 100 个字符', trigger: 'blur' },
  ],
}

function resourceTypeText(type: RedeemResourceOption['resourceType']) {
  return ({ file: '文件', cloud: '网盘', url: '链接', text: '文本信息' })[type] || type
}

function statusText(status: RedeemCodeRecord['status']) {
  return status === 'unused' ? '未使用' : status === 'used' ? '已使用' : '已冻结'
}

function statusTagType(status: RedeemCodeRecord['status']) {
  return status === 'unused' ? 'info' : status === 'used' ? 'success' : 'warning'
}

const exportOptions = computed(() => ([
  {
    value: 'selected' as const,
    label: `选中（${selectedRows.value.length} 条）`,
    description: '导出当前勾选的卡密记录',
    disabled: selectedRows.value.length === 0,
  },
  {
    value: 'page' as const,
    label: `本页（${rows.value.length} 条）`,
    description: '导出当前分页里的卡密记录',
    disabled: rows.value.length === 0,
  },
  {
    value: 'all' as const,
    label: `所有（${total.value} 条）`,
    description: '导出当前筛选结果中的全部卡密记录',
    disabled: total.value === 0,
  },
]))

function handleSizeChange(value: number) {
  void pagination.handleSizeChange(value, loadRows)
}

function handleCurrentChange(value: number) {
  void pagination.handleCurrentChange(value, loadRows)
}

function resetImportForm() {
  importForm.value = { resourceId: undefined, content: '' }
  importFile.value = null
  fileInputKey.value += 1
}

function resetGenerateForm() {
  generateForm.value = {
    resourceId: undefined,
    durationCode: redeemDurationOptions[0]?.value || '1h',
    count: '',
    remark: '',
  }
  generateFormRef.value?.clearValidate()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  importFile.value = target.files?.[0] || null
}

function resetSelectionState() {
  selectedRowState.value = {}
}

async function syncTableSelection() {
  await nextTick()
  const table = tableRef.value
  if (!table) return

  table.clearSelection()
  for (const row of rows.value) {
    if (selectedRowState.value[String(row.id)]) {
      table.toggleRowSelection(row, true)
    }
  }
}

function handleSelectionChange(selection: RedeemCodeRecord[]) {
  const currentIds = new Set(rows.value.map((item) => String(item.id)))
  const nextState = { ...selectedRowState.value }

  Object.keys(nextState).forEach((id) => {
    if (currentIds.has(id)) {
      delete nextState[id]
    }
  })

  selection.forEach((item) => {
    nextState[String(item.id)] = item
  })

  selectedRowState.value = nextState
}

async function loadResources() {
  const result = await redeemApi.getResources()
  resources.value = result || []
}

async function loadRows(page = currentPage.value) {
  loading.value = true
  try {
    const normalizedKeyword = keyword.value.trim()
    const result = await redeemApi.getCodes({
      ...buildPaginationParams(page),
      keyword: normalizedKeyword || undefined,
      status: currentStatus.value || undefined,
    })
    rows.value = result.data || []
    syncFromResponse(result, page)
    resetSelectionState()
    await syncTableSelection()
  } finally {
    loading.value = false
  }
}

async function applyFilters() {
  resetPage()
  await loadRows(1)
}

async function submitImport() {
  if (!importForm.value.resourceId) {
    ElMessage.warning('请先选择资源')
    return
  }
  if (!importFile.value && !importForm.value.content.trim()) {
    ElMessage.warning('请上传 .txt 文件或填写文本内容')
    return
  }
  if (importFile.value && importForm.value.content.trim()) {
    ElMessage.warning('文件导入和手动输入请二选一')
    return
  }

  importSubmitting.value = true
  try {
    if (importFile.value) {
      const result = await redeemApi.importFile({ resourceId: importForm.value.resourceId, file: importFile.value })
      ElMessage.success(`导入成功，批次号 ${result.batchNo}`)
    } else {
      const result = await redeemApi.importText({ resourceId: importForm.value.resourceId, content: importForm.value.content.trim() })
      ElMessage.success(`导入成功，批次号 ${result.batchNo}`)
    }
    importDialogVisible.value = false
    resetImportForm()
    await loadRows()
  } catch (error: any) {
    const details = Array.isArray(error.details) && error.details.length
      ? `：${error.details.slice(0, 3).map((item: any) => item.line ? `第 ${item.line} 行 ${item.reason}` : `${item.code} ${item.reason}`).join('；')}`
      : ''
    ElMessage.error(`${error.error || '导入失败'}${details}`)
  } finally {
    importSubmitting.value = false
  }
}

async function submitGenerate() {
  const form = generateFormRef.value
  if (!form) return

  try {
    await form.validate()
  } catch {
    return
  }

  generateSubmitting.value = true
  try {
    const result = await redeemApi.generate({
      resourceId: Number(generateForm.value.resourceId),
      durationCode: generateForm.value.durationCode,
      count: generateForm.value.count.trim(),
      remark: generateForm.value.remark.trim() || undefined,
    })
    ElMessage.success(`生成成功，共 ${result.successCount} 条，批次号 ${result.batchNo}`)
    generateDialogVisible.value = false
    resetGenerateForm()
    await loadRows()
  } catch (error: any) {
    ElMessage.error(error.error || '生成卡密失败')
  } finally {
    generateSubmitting.value = false
  }
}

async function freezeCode(id: number) {
  try {
    await redeemApi.freezeCode(id)
    ElMessage.success('卡密已冻结')
    await loadRows()
  } catch (error: any) {
    ElMessage.error(error.error || '冻结失败')
  }
}

async function unfreezeCode(id: number) {
  try {
    await redeemApi.unfreezeCode(id)
    ElMessage.success('卡密已解冻')
    await loadRows()
  } catch (error: any) {
    ElMessage.error(error.error || '解冻失败')
  }
}

async function deleteCode(id: number) {
  try {
    await ElMessageBox.confirm('删除后不可恢复，确定删除这条卡密吗？', '删除卡密', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await redeemApi.deleteCode(id)
    ElMessage.success('卡密已删除')
    await loadRows()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.error || '删除失败')
  }
}

function openExportDialog() {
  exportScope.value = selectedRows.value.length ? 'selected' : rows.value.length ? 'page' : 'all'
  exportDialogVisible.value = true
}

function escapeCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function resolveExportRows() {
  if (exportScope.value === 'selected') return selectedRows.value
  if (exportScope.value === 'page') return rows.value
  return []
}

async function fetchAllRowsForExport() {
  const resultRows: RedeemCodeRecord[] = []
  const normalizedKeyword = keyword.value.trim()
  const exportLimit = 200
  let page = 1
  let fetched = 0

  while (true) {
    const result = await redeemApi.getCodes({
      ...buildPaginationParams(page),
      keyword: normalizedKeyword || undefined,
      status: currentStatus.value || undefined,
      limit: exportLimit,
    })

    const batch = result.data || []
    if (!batch.length) break

    resultRows.push(...batch)
    fetched += batch.length
    if (fetched >= Number(result.total || 0)) break
    page += 1
  }

  return resultRows
}

async function submitExport() {
  const exportRows = exportScope.value === 'all' ? await fetchAllRowsForExport() : resolveExportRows()
  if (!exportRows.length) {
    ElMessage.warning('当前没有可导出的卡密数据')
    return
  }

  const headers = ['卡密', '资源名称', '分类', '有效时长', '状态', '备注', '兑换时间', '授权到期', '批次号']
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...exportRows.map((row) => ([
      row.code,
      row.resourceName || '',
      resourceTypeText(row.resourceType),
      formatRedeemDuration(row.durationCode),
      statusText(row.status),
      row.remark || '',
      row.usedAt ? formatDate(row.usedAt) : '',
      row.accessExpireAt ? formatDate(row.accessExpireAt) : '',
      row.batchNo || '',
    ].map((item) => escapeCsvCell(String(item || ''))).join(','))),
  ]

  const fileName = `redeem-codes-${exportScope.value}-${formatDate(new Date(), 'yyyyMMddhhmmss')}.csv`
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  downloadBlobFile(blob, fileName)
  exportDialogVisible.value = false
  ElMessage.success(`已导出 ${exportRows.length} 条卡密`)
}

onMounted(async () => {
  await Promise.all([loadResources(), loadRows()])
})

watch(rows, () => {
  void syncTableSelection()
})
</script>

<template>
  <div class="page-shell redeem-page" v-loading="loading">
    <section class="panel filter-panel">
      <el-form :inline="true" class="filter-row filter-form">
        <el-form-item class="filter-form__keyword">
          <el-input v-model="keyword" placeholder="搜索资源名、卡密或批次号" />
        </el-form-item>
        <el-form-item class="filter-form__status">
          <el-select v-model="currentStatus" placeholder="全部状态" clearable>
            <el-option label="未使用" value="unused" />
            <el-option label="已使用" value="used" />
            <el-option label="已冻结" value="disabled" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-form__submit">
          <el-button type="primary" @click="applyFilters">搜索</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="panel filter-panel filter-panel--actions">
      <div class="filter-actions">
        <el-button plain @click="openExportDialog">批量导出</el-button>
        <el-button plain @click="importDialogVisible = true">自定义/导入卡密</el-button>
        <el-button type="primary" @click="generateDialogVisible = true">生成卡密</el-button>
      </div>
    </section>

    <section class="panel table-card">
      <el-table ref="tableRef" :data="rows" row-key="id" empty-text="暂无卡密数据" table-layout="fixed"
        style="width: 100%;"
        @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column label="卡密" width="120">
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
        <el-table-column label="有效时长" min-width="120">
          <template #default="{ row }">
            {{ formatRedeemDuration(row.durationCode) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180">
          <template #default="{ row }">
            <span class="table-ellipsis" :title="row.remark || ''">{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <RcStatusTag :type="statusTagType(row.status)" :text="statusText(row.status)" />
          </template>
        </el-table-column>
        <el-table-column label="兑换时间" min-width="170">
          <template #default="{ row }">
            {{ row.usedAt ? formatDate(row.usedAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="授权到期" min-width="170">
          <template #default="{ row }">
            {{ row.accessExpireAt ? formatDate(row.accessExpireAt) : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="140">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button v-if="row.status === 'disabled'" text type="primary"
                @click="unfreezeCode(row.id)">解冻</el-button>
              <el-button v-else text type="warning" :disabled="row.status !== 'unused'"
                @click="freezeCode(row.id)">冻结</el-button>
              <el-button text type="danger" :disabled="row.status === 'used'" @click="deleteCode(row.id)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next, jumper" :total="total" :page-sizes="[10, 20, 30, 50]" @size-change="handleSizeChange"
          @current-change="handleCurrentChange" />
      </div>
    </section>

    <el-dialog v-model="exportDialogVisible" title="批量导出卡密" width="560px">
      <div class="export-dialog">
        <p class="export-dialog__desc">请选择导出范围，系统会按当前数据生成 CSV 文件并直接下载到本地。</p>
        <el-radio-group v-model="exportScope" class="export-dialog__group">
          <el-radio v-for="item in exportOptions" :key="item.value" :value="item.value" :disabled="item.disabled">
            <div class="export-dialog__option">
              <strong>{{ item.label }}</strong>
              <span>{{ item.description }}</span>
            </div>
          </el-radio>
        </el-radio-group>
      </div>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitExport">导出</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="自定义/导入卡密" width="760px" @closed="resetImportForm">
      <div class="dialog-grid">
        <el-form label-position="top">
          <el-form-item label="选择资源">
            <el-select v-model="importForm.resourceId" filterable placeholder="请选择自己发布的资源">
              <el-option v-for="item in resources" :key="item.id" :label="item.fileName" :value="item.id">
                <div class="resource-option">
                  <span>{{ item.fileName }}</span>
                  <small>{{ resourceTypeText(item.resourceType) }}</small>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="选择文件 (.txt)">
            <input :key="fileInputKey" type="file" accept=".txt" @change="handleFileChange" />
            <small v-if="importFile" class="hint-file">已选择：{{ importFile.name }}</small>
          </el-form-item>

          <el-form-item label="手动输入">
            <el-input v-model="importForm.content" type="textarea" :rows="10" placeholder="一行一条，例如：ABC123,1h" />
          </el-form-item>
        </el-form>

        <div class="import-tips">
          <p>格式说明：每行一条，格式为 `卡密,有效时长`</p>
          <p>有效时长仅支持：{{ durationCodesText }}</p>
          <pre>ABC123,1h
        DEF456,3d
        XYZ789,30d</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" @click="submitImport">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="generateDialogVisible" title="生成卡密" width="760px" @closed="resetGenerateForm">
      <div class="dialog-grid">
        <el-form ref="generateFormRef" :model="generateForm" :rules="generateRules" label-position="top">
          <el-form-item label="选择资源" prop="resourceId">
            <el-select v-model="generateForm.resourceId" filterable placeholder="请选择自己发布的资源">
              <el-option v-for="item in resources" :key="item.id" :label="item.fileName" :value="item.id">
                <div class="resource-option">
                  <span>{{ item.fileName }}</span>
                  <small>{{ resourceTypeText(item.resourceType) }}</small>
                </div>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="选择时长" prop="durationCode">
            <el-radio-group v-model="generateForm.durationCode" class="duration-group">
              <el-radio v-for="item in redeemDurationOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="生成条数" prop="count">
            <el-input v-model="generateForm.count" type="text" placeholder="请输入生成条数，例如 20" />
          </el-form-item>

          <el-form-item label="备注">
            <el-input v-model="generateForm.remark" type="textarea" :rows="3" maxlength="100" show-word-limit
              placeholder="可选，记录这批卡密的用途或来源" />
          </el-form-item>
        </el-form>

        <div class="import-tips">
          <p>生成后的卡密会直接写入当前列表。</p>
          <p>有效时长统一走公共时长列表，当前支持：{{ durationCodesText }}</p>
          <p>条数输入框虽然是文本框，但会按数字规则校验，仅支持 1 到 500。</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="generateSubmitting" @click="submitGenerate">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.redeem-page {
  display: grid;
  gap: 18px;
  min-width: 0;
}

.redeem-page > * {
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

.filter-panel--actions {
  padding-top: 18px;
  padding-bottom: 18px;
}

.filter-form {
  display: grid;
  grid-template-columns: minmax(320px, 460px) 180px auto;
  gap: 14px;
  align-items: start;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 0;
  }

  &__keyword {
    :deep(.el-input) {
      width: 100%;
    }
  }

  &__status {
    :deep(.el-select) {
      width: 100%;
    }
  }
}

.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.table-ellipsis {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.dialog-grid {
  display: grid;
  gap: 16px;
}

.export-dialog {
  display: grid;
  gap: 16px;

  &__desc {
    margin: 0;
    color: var(--rc-text-soft);
  }

  &__group {
    display: grid;
    gap: 14px;
  }

  &__option {
    display: grid;
    gap: 4px;

    strong {
      color: var(--rc-text);
      font-size: 14px;
      font-weight: 600;
    }

    span {
      color: var(--rc-text-soft);
      font-size: 12px;
      line-height: 1.5;
    }
  }
}

.resource-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  small {
    color: var(--rc-text-soft);
    font-size: 12px;
  }
}

.duration-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
}

.hint-file,
.import-tips p {
  color: var(--rc-text-soft);
}

.import-tips {
  padding: 14px 16px;
  border-radius: 14px;
  background: #f6f8ff;

  p {
    margin: 0 0 8px;
  }

  pre {
    margin: 0;
    font-family: Consolas, monospace;
    white-space: pre-wrap;
  }
}

@media (max-width: 960px) {
  .filter-form {
    grid-template-columns: 1fr;
  }

  .filter-actions {
    gap: 10px;
  }

  .table-card {
    overflow-x: auto;
  }

  .table-card :deep(.el-table) {
    min-width: 980px;
  }
}
</style>
