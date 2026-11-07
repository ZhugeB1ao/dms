import ErrorPage from './ErrorPage.tsx'

export default function NotFoundPage() {
  return <ErrorPage code={404} message="Page not found" />
}
