import '@testing-library/jest-dom/vitest'
import { tokenStore } from '../auth/tokenStore'

beforeEach(() => {
  // No session leaks from one test to the next.
  tokenStore.clear()
  window.localStorage.clear()
})
