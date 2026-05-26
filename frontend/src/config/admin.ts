import type { Component } from 'vue'
import {
  Files,
  CreditCard,
  Bell,
  User,
  Plus,
  Reading,
  DataBoard,
} from '@element-plus/icons-vue'

export interface AdminNavItem {
  path: string
  label: string
  icon: Component
  group?: 'main' | 'secondary'
  children?: Array<{
    label: string
    path: string
    query?: Record<string, string>
  }>
}

export const adminNavItems: AdminNavItem[] = [
  { path: '/dashboard', label: '概览', icon: DataBoard, group: 'main' },
  { path: '/resources', label: '资源管理', icon: Files, group: 'main' },
  { path: '/redeem-codes', label: '卡密管理', icon: CreditCard, group: 'main' },
  { path: '/redeem-records', label: '兑换记录', icon: Reading, group: 'main' },
  { path: '/messages', label: '消息中心', icon: Bell, group: 'secondary' },
  {
    path: '/profile',
    label: '账号中心',
    icon: User,
    group: 'secondary',
    children: [
      { label: '个人信息', path: '/profile', query: { section: 'info' } },
      { label: '偏好设置', path: '/profile', query: { section: 'preferences' } },
      { label: '安全日志', path: '/profile', query: { section: 'security' } },
      { label: '账户管理', path: '/profile', query: { section: 'account' } },
    ],
  },
]

export const quickLinks = [
  { path: '/upload', label: '发布资源', icon: Plus },
  { path: '/resources', label: '资源管理', icon: Files },
  { path: '/redeem-codes', label: '卡密管理', icon: CreditCard },
  { path: '/redeem-records', label: '兑换记录', icon: Reading },
]
