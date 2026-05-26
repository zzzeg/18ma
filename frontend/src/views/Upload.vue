<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { shareApi, type ShareRecord } from '../api/services'
import { copyToClipboard, generateShareLink } from '../utils/utils'

interface ResourceOption {
  value: 'file' | 'cloud' | 'url' | 'text'
  typeValue: '文件' | '网盘' | '链接' | '文本信息'
  label: string
}

const options: ResourceOption[] = [
  { value: 'file', typeValue: '文件', label: '本地文件' },
  { value: 'cloud', typeValue: '网盘', label: '网盘链接' },
  { value: 'url', typeValue: '链接', label: 'URL 链接' },
  { value: 'text', typeValue: '文本信息', label: '文本信息' },
]

const route = useRoute()
const editCode = computed(() => String(route.query.code || ''))
const isEditMode = computed(() => Boolean(editCode.value))
const active = ref<ResourceOption>(options[0])
const loading = ref(false)
const pageLoading = ref(false)
const shareCode = ref('')
const file = ref<File | null>(null)
const uploadedFileName = ref('')
const form = ref({
  fileName: '',
  note: '',
  cloudUrl: '',
  extractionCode: '',
  url: '',
  autoRedirect: false,
  content: '',
})

const textCount = computed(() => form.value.content.trim().length)
const currentFileDisplayName = computed(() => {
  if (file.value?.name) return file.value.name
  if (isEditMode.value && active.value.value === 'file') {
    return uploadedFileName.value || ''
  }
  return ''
})

function onFileChange(uploadFile: { raw?: File }) {
  file.value = uploadFile.raw || null
}

function applyShareToForm(data: ShareRecord) {
  shareCode.value = data.shareCode
  file.value = null
  uploadedFileName.value = data.resourceType === 'file' ? (data.uploadedFileName || '') : ''
  const matched = options.find((item) => item.value === data.resourceType) || options[0]
  active.value = matched
  form.value = {
    fileName: data.fileName || '',
    note: data.note || '',
    cloudUrl: data.cloudUrl || '',
    extractionCode: data.extractionCode || '',
    url: data.url || '',
    autoRedirect: Boolean(data.autoRedirect),
    content: data.content || '',
  }
}

async function loadEditShare() {
  if (!isEditMode.value) return
  pageLoading.value = true
  try {
    const data = await shareApi.getShare(editCode.value)
    applyShareToForm(data)
  } catch (error: any) {
    ElMessage.error(error.error || '资源加载失败')
  } finally {
    pageLoading.value = false
  }
}

async function publish() {
  if (!form.value.fileName.trim()) {
    ElMessage.warning('请填写资源名称')
    return
  }

  if (active.value.value === 'file' && !isEditMode.value && !file.value) {
    ElMessage.warning('请上传文件')
    return
  }

  if (active.value.value === 'cloud' && !form.value.cloudUrl) {
    ElMessage.warning('请输入网盘地址')
    return
  }

  if (active.value.value === 'url' && !form.value.url) {
    ElMessage.warning('请输入链接地址')
    return
  }

  if (active.value.value === 'text' && !form.value.content.trim()) {
    ElMessage.warning('请输入文本信息')
    return
  }

  loading.value = true
  try {
    if (isEditMode.value) {
      await shareApi.updateShare(editCode.value, {
        file: file.value,
        fileName: form.value.fileName.trim(),
        note: form.value.note,
        resourceType: active.value.value,
        cloudUrl: form.value.cloudUrl,
        extractionCode: form.value.extractionCode,
        url: form.value.url,
        autoRedirect: form.value.autoRedirect,
        content: form.value.content,
      })
      shareCode.value = editCode.value
      ElMessage.success('资源更新成功')
    } else {
      const result = await shareApi.upload({
        file: file.value,
        fileName: form.value.fileName.trim(),
        note: form.value.note,
        resourceType: active.value.value,
        cloudUrl: form.value.cloudUrl,
        extractionCode: form.value.extractionCode,
        url: form.value.url,
        autoRedirect: form.value.autoRedirect,
        content: form.value.content,
      })
      shareCode.value = result.shareCode
      ElMessage.success('资源发布成功')
    }
  } catch (error: any) {
    ElMessage.error(error.error || (isEditMode.value ? '资源更新失败' : '资源发布失败'))
  } finally {
    loading.value = false
  }
}

async function copyLink() {
  await copyToClipboard(generateShareLink(shareCode.value))
  ElMessage.success('分享链接已复制')
}

onMounted(() => {
  void loadEditShare()
})
</script>

<template>
  <div class="page-shell upload-page" v-loading="pageLoading">
    <section class="upload-layout panel">
      <el-form class="form-flex" label-position="right" label-width="140px" style="max-width:1200px">
        <el-form-item label="" class="type-switch">
          <div class="type-switch__list">
            <button v-for="item in options" :key="item.value" :class="{ 'is-active': active.value === item.value }"
              @click.prevent="active = item">
              {{ item.value === 'file' ? '文件资源' : item.value === 'cloud' ? '网盘资源' : item.value === 'url' ? 'URL链接' :
                '文本信息' }}
            </button>
          </div>
        </el-form-item>

        <el-form-item label="资源名称：">
          <el-input v-model="form.fileName" maxlength="40" placeholder="最长40个字符，请勿填写敏感词和特殊字符..." />
        </el-form-item>

        <el-form-item label="">
          <div class="upload-drop">
            <strong>该部分内容兑换后可见</strong>
            <template v-if="active.value === 'file'">
              <el-upload class="upload-demo" drag :auto-upload="false" :show-file-list="false" :limit="1"
                :on-change="onFileChange">
                <el-icon class="el-icon--upload">
                  <UploadFilled />
                </el-icon>
                <div class="el-upload__text">
                  将文件拖到此处，或 <em>{{ isEditMode ? '点击替换文件' : '点击上传文件' }}</em>
                </div>
                <template #tip>
                  <div class="el-upload__tip">
                    <template v-if="currentFileDisplayName">
                      <span>{{ isEditMode ? '当前文件：' : '已选择文件：' }}</span>
                      <span class="upload-tip__filename">{{ currentFileDisplayName }}</span>
                    </template>
                    <template v-else>
                      {{ isEditMode ? '保留原文件，可选择上传新文件替换' : '支持点击或拖拽上传文件' }}
                    </template>
                  </div>
                </template>
              </el-upload>
              <small>（最大200MB）</small>
            </template>
            <template v-else-if="active.value === 'cloud'">
              <small>资源内容：</small>
              <el-input v-model="form.cloudUrl" placeholder="网盘URL地址，以http或https开头" />
              <el-input v-model="form.extractionCode" placeholder="文件提取码（没有提取码可不填写）" />
            </template>
            <template v-else-if="active.value === 'url'">
              <small>资源内容：</small>
              <el-input v-model="form.url" placeholder="网站URL地址，以http或https开头" />
              <el-checkbox v-model="form.autoRedirect">自动跳转</el-checkbox>
            </template>
            <template v-else>
              <small>资源内容：</small>
              <el-input v-model="form.content" type="textarea" :rows="6" maxlength="200"
                placeholder="请输入文本内容，不超过200字！" />
              <small>（提示：文本内容不超过 200 字，目前已有 {{ textCount }} 字）</small>
            </template>
          </div>
        </el-form-item>

        <el-form-item label="备注（非必填）：">
          <el-input v-model="form.note" placeholder="这里可以补充文件解压密码、使用说明、简要备注等信息" />
        </el-form-item>

        <el-form-item label="">
          <section class="publish-actions">
            <div v-if="shareCode" class="panel result-card">
              <div>
                <small class="result-card__label">分享码</small>
                <strong>{{ shareCode }}</strong>
              </div>
              <div class="result-card__actions">
                <!-- <el-button type="success" plain @click="copyCode">复制分享码</el-button> -->
                <el-button type="success" @click="copyLink">复制分享链接</el-button>
              </div>
            </div>
            <div class="publish-actions__buttons">
              <el-button type="primary" :loading="loading" @click="publish">{{ isEditMode ? '保存修改' : '提交' }}</el-button>
            </div>
          </section>
        </el-form-item>
      </el-form>
    </section>
  </div>
</template>

<style scoped lang="scss">
.upload-page,
.upload-layout {
  display: grid;
  gap: 16px;
  max-width: 1400px;
}

.form-flex {
  padding: 20px;

  :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  :deep(.el-form-item__content) {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  :deep(.el-form-item__label) {
    color: var(--rc-text-soft);
    font-weight: 500;
  }

  :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }
}

.upload-drop {
  min-height: 180px;
  border-radius: 4px;
  border: 1px dashed #b3d8ff;
  background: #fafcff;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 6px;
  padding: 22px;
  width: 100%;

  strong {
    font-size: 15px;
    color: orangered;
  }

  small {
    color: var(--rc-text-soft);
  }

  :deep(.upload-demo) {
    width: min(100%, 560px);
  }

  :deep(.el-upload) {
    width: 100%;
  }

  :deep(.el-upload-dragger) {
    width: 100%;
    border-radius: 4px;
    border-color: #c6e2ff;
    background: #fff;
  }

  :deep(.el-icon--upload) {
    margin-bottom: 10px;
    font-size: 44px;
    color: #1a8ce3;
  }

  :deep(.el-upload__text) {
    color: #40566f;
    font-size: 14px;
  }

  :deep(.el-upload__text em) {
    color: #1a8ce3;
    font-style: normal;
  }

  :deep(.el-upload__tip) {
    margin-top: 10px;
    color: var(--rc-text-soft);
    line-height: 1.6;
    font-size: 16px;
    font-weight: 700;
  }

  :deep(.upload-tip__filename) {
    color: #0564ac;
    text-decoration: underline;
    cursor: pointer;
  }
}

.type-switch {
  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    button {
      height: 34px;
      padding: 0 16px;
      border: 1px solid var(--rc-border);
      border-radius: 4px;
      background: #fff;
      color: var(--rc-text-soft);
      cursor: pointer;
      font-weight: 500;

      &.is-active {
        background: var(--rc-primary-soft);
        border-color: #c6e2ff;
        color: var(--rc-primary);
      }
    }
  }
}

.publish-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;

  &__buttons {
    display: flex;
    gap: 12px;
    width: 100%;
  }
}

.result-card {
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;

  small {
    color: var(--rc-text-soft);
  }

  &__label {
    display: block;
    margin-bottom: 4px;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    margin-top: 6px;
    font-size: 28px;
    letter-spacing: 0.18em;
  }

  &__actions {
    display: flex;
    gap: 12px;
  }
}

@media (max-width: 1080px) {
  .publish-actions {
    align-items: stretch;

    &__buttons,
    .result-card__actions {
      width: 100%;
      flex-wrap: wrap;
    }
  }
}
</style>
