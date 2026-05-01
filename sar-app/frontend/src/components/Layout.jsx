import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { isRescuer, useAuth } from '../auth/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  function handleLogout() {
    logout()
    nav('/login')
  }

  return (
    <div className="app">
      <nav className="nav">
        <span className="brand">⚓ SAR CONSOLE</span>
        {user && (
          <>
            {isRescuer(user) ? (
              <NavLink to="/dashboard">Dashboard</NavLink>
            ) : (
              <NavLink to="/report">Report SOS</NavLink>
            )}
            <NavLink to="/incidents">Incidents</NavLink>
            <NavLink to="/supplies">Supplies</NavLink>
          </>
        )}
        <span className="spacer" />
        {user ? (
          <>
            <span className="role-badge">{user.role}</span>
            <span className="muted small">{user.full_name}</span>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
            <NavLink to="/operations">Operations</NavLink>
          </>
        )}
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
