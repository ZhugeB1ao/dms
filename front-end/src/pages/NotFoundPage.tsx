import ErrorPage from '@/pages/ErrorPage.tsx'

export default function NotFoundPage() {
  return <ErrorPage code={404} message="Page not found" />
}
