import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import VictimReport from './pages/VictimReport'
import RescuerDashboard from './pages/RescuerDashboard'
import IncidentDetail from './pages/IncidentDetail'
import Supplies from './pages/Supplies'
import Operations from './pages/Operations' 
import { isRescuer, useAuth } from './auth/AuthContext'

function Home() {
  const { user, loading } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={isRescuer(user) ? '/dashboard' : '/report'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        <Route path="report"
          element={<PrivateRoute><VictimReport /></PrivateRoute>} />
        <Route path="dashboard"
          element={<PrivateRoute rescuerOnly><RescuerDashboard /></PrivateRoute>} />
        <Route path="incidents"
          element={<PrivateRoute><RescuerDashboard /></PrivateRoute>} />
        <Route path="incidents/:id"
          element={<PrivateRoute><IncidentDetail /></PrivateRoute>} />
        <Route path="supplies"
          element={<PrivateRoute><Supplies /></PrivateRoute>} />
        <Route path="operations"
          element={<PrivateRoute><Operations /></PrivateRoute>} /> 

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
