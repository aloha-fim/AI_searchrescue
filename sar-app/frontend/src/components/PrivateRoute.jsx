import { Navigate } from 'react-router-dom'
import { isRescuer, useAuth } from '../auth/AuthContext'

export default function PrivateRoute({ children, rescuerOnly = false }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (rescuerOnly && !isRescuer(user)) return <Navigate to="/incidents" replace />
  return children
}
