import { beforeEach, describe, expect, it } from 'vitest'
import {
  getUsername,
  setUsername,
  removeUsername,
  isAuthenticated,
  setToken,
  removeToken,
} from './auth'

const storage = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value))
    },
    removeItem: (key: string) => {
      storage.delete(key)
    },
    clear: () => {
      storage.clear()
    },
  },
  configurable: true,
})

describe('auth storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores username as the auth identity', () => {
    setToken('token')
    setUsername('user_1234')

    expect(getUsername()).toBe('user_1234')
    expect(isAuthenticated()).toBe(true)

    removeToken()
  })

  it('clears username independently', () => {
    setUsername('user_1234')
    removeUsername()
    expect(getUsername()).toBeNull()
  })
})
