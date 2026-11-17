import ErrorPage from '@/pages/ErrorPage.tsx'

export default function ForbiddenPage() {
  return <ErrorPage code={403} message="Access denied" />
}
