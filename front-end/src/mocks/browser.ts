import { setupWorker } from 'msw/browser'
import { browserHandlers } from './handlers.ts'
export const worker = setupWorker(...browserHandlers)
