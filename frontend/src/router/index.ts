import { createRouter, createWebHistory } from 'vue-router'
import { getRole, isAuthenticated } from '../utils/auth'
import { doneRouteProgress, resetProgress, startRouteProgress } from '../utils/progress'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/index' },
    { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
    { path: '/register', name: 'register', component: () => import('../views/Register.vue') },
    { path: '/dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索资源、卡密或订单...' } },
    { path: '/resources', name: 'resources', component: () => import('../views/Resources.vue'), meta: { requiresAuth: true, searchPlaceholder: '输入资源名称或资源 ID...' } },
    { path: '/upload', name: 'upload', component: () => import('../views/Upload.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索资源...' } },
    { path: '/index/:code?', name: 'index', component: () => import('../views/IndexRedeem.vue') },
    { path: '/share/:code?', name: 'share', component: () => import('../views/ShareDetail.vue') },
    { path: '/order-query', redirect: '/redeem-records' },
    { path: '/guest-query', redirect: '/index' },
    { path: '/redeem-codes', name: 'redeem-codes', component: () => import('../views/RedeemCodes.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索资源、卡密或批次号...' } },
    { path: '/redeem-records', name: 'redeem-records', component: () => import('../views/RedeemRecords.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索资源名称或卡密...' } },
    { path: '/users', name: 'users', component: () => import('../views/UserManagement.vue'), meta: { requiresAuth: true, requiresAdmin: true, searchPlaceholder: '搜索用户名、昵称或联系方式...' } },
    { path: '/withdraw-account', name: 'withdraw-account', component: () => import('../views/WithdrawAccount.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索提现账户信息...' } },
    { path: '/withdrawals', name: 'withdrawals', component: () => import('../views/Withdrawals.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索提现记录...' } },
    { path: '/withdraw-apply', name: 'withdraw-apply', component: () => import('../views/WithdrawApply.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索提现申请...' } },
    { path: '/messages', name: 'messages', component: () => import('../views/Messages.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索功能或消息...' } },
    { path: '/profile', name: 'profile', component: () => import('../views/Profile.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索功能或文档...' } },
    { path: '/about', name: 'about', component: () => import('../views/About.vue'), meta: { requiresAuth: true, searchPlaceholder: '搜索资源或订单...' } },
    { path: '/service-protocol', name: 'service-protocol', component: () => import('../views/ServiceProtocol.vue') },
    { path: '/balance', redirect: '/dashboard' },
    { path: '/payment-records', redirect: '/redeem-records' },
    { path: '/payment-channels', redirect: '/profile' },
    { path: '/recharge-records', redirect: '/dashboard' },
    { path: '/recharge-withdrawal', redirect: '/withdraw-apply' },
  ],
})

router.beforeEach((to, _from, next) => {
  startRouteProgress()

  if (to.meta.requiresAuth && !isAuthenticated()) {
    next({ name: 'login' })
    return
  }

  if (to.meta.requiresAdmin && getRole() !== 'admin') {
    next({ name: 'dashboard' })
    return
  }

  if ((to.name === 'login' || to.name === 'register') && isAuthenticated()) {
    next({ name: 'dashboard' })
    return
  }

  next()
})

router.afterEach(() => {
  doneRouteProgress()
})

router.onError(() => {
  resetProgress()
})

export default router
