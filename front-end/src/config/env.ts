export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost/api/v1',
  mockEnabled:
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS !== 'false',
}
