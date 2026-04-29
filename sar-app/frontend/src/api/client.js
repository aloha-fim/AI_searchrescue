const TOKEN_KEY = 'sar_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const data = await res.json()
      msg = data.detail || JSON.stringify(data)
    } catch {}
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // auth
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me'),

  // incidents
  listIncidents: (status) =>
    request(`/api/incidents${status ? `?status=${status}` : ''}`),
  getIncident: (id) => request(`/api/incidents/${id}`),
  createIncident: (payload) => request('/api/incidents', { method: 'POST', body: payload }),
  updateIncident: (id, payload) =>
    request(`/api/incidents/${id}`, { method: 'PATCH', body: payload }),
  postMessage: (id, text) =>
    request(`/api/incidents/${id}/messages`, { method: 'POST', body: { text } }),
  uploadImage: (id, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return request(`/api/incidents/${id}/images`, { method: 'POST', body: fd, isForm: true })
  },

  // supplies
  listSupplies: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/supplies${qs ? `?${qs}` : ''}`)
  },
  createSupply: (payload) => request('/api/supplies', { method: 'POST', body: payload }),
  updateSupply: (id, payload) =>
    request(`/api/supplies/${id}`, { method: 'PATCH', body: payload }),
  addTransaction: (id, payload) =>
    request(`/api/supplies/${id}/transactions`, { method: 'POST', body: payload }),
  listTransactions: (id) => request(`/api/supplies/${id}/transactions`),
}

export function imageUrl(imageId) {
  return `/api/images/${imageId}`
}

// Authenticated image fetch -> object URL (because the endpoint requires Authorization).
export async function fetchImageBlobUrl(imageId) {
  const token = getToken()
  const res = await fetch(`/api/images/${imageId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('image fetch failed')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
