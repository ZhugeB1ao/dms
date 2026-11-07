import { BrowserRouter } from 'react-router'
import AuthProvider from '../features/auth/context/AuthProvider.tsx'
import AppRouter from './router/AppRouter.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  )
}
