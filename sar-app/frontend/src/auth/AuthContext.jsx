import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../api/client'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const res = await api.login({ email, password })
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }
  async function register(payload) {
    const res = await api.register(payload)
    setToken(res.access_token)
    setUser(res.user)
    return res.user
  }
  function logout() {
    setToken(null)
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const RESCUER_ROLES = ['pilot', 'swimmer', 'watchstander', 'admin']
export function isRescuer(user) {
  return user && RESCUER_ROLES.includes(user.role)
}
