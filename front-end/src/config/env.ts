export const env = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? '/api' : 'http://localhost:9090/api'),
  mockEnabled:
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true',
}
