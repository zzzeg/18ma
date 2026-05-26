import { ref } from 'vue'
import type { PaginatedListResponse } from '../api/services'

type Loader = (page: number) => unknown | Promise<unknown>

export function useServerPagination(initialPageSize = 10) {
  const currentPage = ref(1)
  const pageSize = ref(initialPageSize)
  const total = ref(0)

  function buildPaginationParams(page = currentPage.value) {
    return {
      page,
      limit: pageSize.value,
    }
  }

  function syncFromResponse<T>(result: Pick<PaginatedListResponse<T>, 'total' | 'page' | 'limit'>, fallbackPage = currentPage.value) {
    total.value = Number(result.total || 0)
    currentPage.value = Number(result.page || fallbackPage || 1)
    if (result.limit) {
      pageSize.value = Number(result.limit)
    }
  }

  function resetPage() {
    currentPage.value = 1
  }

  async function handleSizeChange(value: number, loader: Loader) {
    pageSize.value = value
    currentPage.value = 1
    await loader(1)
  }

  async function handleCurrentChange(value: number, loader: Loader) {
    currentPage.value = value
    await loader(value)
  }

  return {
    currentPage,
    pageSize,
    total,
    buildPaginationParams,
    syncFromResponse,
    resetPage,
    handleSizeChange,
    handleCurrentChange,
  }
}
