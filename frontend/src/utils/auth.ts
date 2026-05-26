const TOKEN_KEY = 'token'
const PHONE_KEY = 'phone'
const NICKNAME_KEY = 'nickname'
const ROLE_KEY = 'role'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getPhone(): string | null {
  return localStorage.getItem(PHONE_KEY)
}

export function setPhone(phone: string): void {
  localStorage.setItem(PHONE_KEY, phone)
}

export function removePhone(): void {
  localStorage.removeItem(PHONE_KEY)
}

export function getNickName(): string | null {
  return localStorage.getItem(NICKNAME_KEY)
}

export function setNickName(nickname: string): void {
  localStorage.setItem(NICKNAME_KEY, nickname)
}

export function removeNickName(): void {
  localStorage.removeItem(NICKNAME_KEY)
}

export function getRole(): string | null {
  return localStorage.getItem(ROLE_KEY)
}

export function setRole(role: string): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function removeRole(): void {
  localStorage.removeItem(ROLE_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken() && !!getPhone()
}
