import { setupWorker } from 'msw/browser'
import { browserHandlers } from '@/mocks/handlers.ts'
export const worker = setupWorker(...browserHandlers)
