import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Header from './Header.tsx'
import Sidebar from './Sidebar.tsx'
import SignupDemoModal from '../../features/auth/components/SignupDemoModal.tsx'
import type { DemoAuthMode } from '../../features/auth/components/SignupDemoForm.tsx'
import { Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/context/useAuth.ts'

export default function AppLayout() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [authMode, setAuthMode] = useState<DemoAuthMode>('login')
  const [authOpen, setAuthOpen] = useState(false)
  const mobileSidebarRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    function closeMobileSidebar(event: MediaQueryListEvent) {
      if (event.matches && mobileSidebarRef.current?.open)
        mobileSidebarRef.current.close()
    }
    media.addEventListener('change', closeMobileSidebar)
    return () => media.removeEventListener('change', closeMobileSidebar)
  }, [])

  function toggleSidebar() {
    if (window.matchMedia('(max-width: 767px)').matches)
      mobileSidebarRef.current?.showModal()
    else setSidebarOpen((open) => !open)
  }

  function openAuth(mode: DemoAuthMode) {
    if (mode === 'login') {
      navigate('/login')
      return
    }
    setAuthMode(mode)
    setAuthOpen(true)
  }

  function closeAuth() {
    setAuthOpen(false)
  }

  function switchAuthMode(mode: DemoAuthMode) {
    if (mode === 'login') {
      closeAuth()
      navigate('/login')
    } else {
      setAuthMode(mode)
    }
  }

  function closeMobileSidebar() {
    mobileSidebarRef.current?.close()
  }

  function handleSidebarBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) closeMobileSidebar()
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div
        className="app-shell min-h-dvh"
        data-sidebar-open={sidebarOpen}
        data-authenticated={Boolean(auth.user)}
      >
        {auth.user && <Sidebar collapsed={!sidebarOpen} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
            onAuth={openAuth}
            user={auth.user}
            onLogout={auth.logout}
          />
          <main
            id="main-content"
            className="min-h-0 flex-1"
            aria-label="Main content"
            tabIndex={-1}
          >
            <Outlet />
          </main>
        </div>
      </div>
      {auth.user && (
        <dialog
          id="sidebar-dialog"
          ref={mobileSidebarRef}
          className="sidebar-dialog"
          aria-label="Sidebar menu"
          onClick={handleSidebarBackdropClick}
        >
          <Sidebar mobile onClose={closeMobileSidebar} />
        </dialog>
      )}
      <SignupDemoModal
        open={authOpen}
        mode={authMode}
        onClose={closeAuth}
        onSwitch={switchAuthMode}
      />
    </>
  )
}
