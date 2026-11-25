import type { Ref } from 'react'
import Button from '@/shared/components/Button.tsx'
import { PanelIcon } from '@/shared/components/Icons.tsx'
import type { User } from '@/shared/types/domain.ts'
import type { DemoAuthMode } from '@/features/auth/components/SignupDemoForm.tsx'

export interface HeaderProps {
  toggleRef?: Ref<HTMLButtonElement>
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onAuth: (mode: DemoAuthMode) => void
  user: User | null
  onLogout: () => void
}

export default function Header({
  toggleRef,
  sidebarOpen,
  onToggleSidebar,
  onAuth,
  user,
  onLogout,
}: HeaderProps) {
  function handleSignUp() {
    onAuth('signup')
  }

  return (
    <header className="flex min-h-18 shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-5">
      {user && (
        <>
          {!sidebarOpen && (
            <Button
              ref={toggleRef}
              variant="icon"
              className="desktop-toggle"
              aria-label="Open sidebar"
              aria-controls="desktop-sidebar"
              aria-expanded={sidebarOpen}
              onClick={onToggleSidebar}
            >
              <PanelIcon />
            </Button>
          )}
          <Button
            variant="icon"
            className="mobile-toggle"
            aria-label="Open sidebar"
            aria-haspopup="dialog"
            aria-controls="sidebar-dialog"
            onClick={onToggleSidebar}
          >
            <PanelIcon />
          </Button>
        </>
      )}
      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <>
            <Button variant="secondary" onClick={onLogout}>
              Log out
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleSignUp}>
              Sign up
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
