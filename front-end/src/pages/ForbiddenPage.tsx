import ErrorPage from './ErrorPage.tsx'

export default function ForbiddenPage() {
  return <ErrorPage code={403} message="Access denied" />
}
