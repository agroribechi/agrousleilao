import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { getUser } from './lib/api.js'
import LoginPage from './pages/LoginPage.jsx'
import AuctionsList from './pages/AuctionsList.jsx'
import AuctionLive from './pages/AuctionLive.jsx'
import CaptureFrame from './pages/CaptureFrame.jsx'

function BottomNav() {
  const location = useLocation()
  const isLivePage = location.pathname.includes('/live/')

  return (
    <nav className="bottom-nav">
      <NavLink to="/auctions" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Leilões
      </NavLink>

      {isLivePage && (
        <NavLink
          to={location.pathname.replace('/live/', '/capture/')}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Print
        </NavLink>
      )}

      <NavLink to="/auctions" className="nav-item" onClick={() => { localStorage.clear(); window.location.reload(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        Sair
      </NavLink>
    </nav>
  )
}

function RequireAuth({ children }) {
  const user = getUser()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auctions" element={
            <RequireAuth>
              <>
                <AuctionsList />
                <BottomNav />
              </>
            </RequireAuth>
          } />
          <Route path="/live/:auctionId" element={
            <RequireAuth>
              <>
                <AuctionLive />
                <BottomNav />
              </>
            </RequireAuth>
          } />
          <Route path="/capture/:auctionId" element={
            <RequireAuth>
              <>
                <CaptureFrame />
                <BottomNav />
              </>
            </RequireAuth>
          } />
          <Route path="*" element={<Navigate to={getUser() ? '/auctions' : '/login'} replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
