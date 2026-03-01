import '@testing-library/jest-dom'
import { server } from './tests/mocks/server'
import React from 'react'

// Mock next/server before any imports that might use it
jest.mock('next/server', () => {
  // Create a mock NextRequest class
  class MockNextRequest {
    url: string
    method: string
    headers: Map<string, string>
    body: any

    constructor(input: string | URL, init?: any) {
      this.url = typeof input === 'string' ? input : input.toString()
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body
    }

    json() {
      return Promise.resolve(this.body ? JSON.parse(this.body) : {})
    }
  }

  // Create a mock NextResponse class
  class MockNextResponse {
    status: number
    _data: any
    headers: Map<string, string>

    constructor(data: any, init?: any) {
      this._data = data
      this.status = init?.status || 200
      this.headers = new Map()
    }

    json() {
      return Promise.resolve(this._data)
    }

    static json(data: any, init?: { status?: number; headers?: Record<string, string> }) {
      const response = new MockNextResponse(data, init)
      return response
    }

    static redirect(url: string, status = 307) {
      const response = new MockNextResponse(null, { status })
      response.headers.set('Location', url)
      return response
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  }
})

// Setup MSW
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Mock next-intl with NextIntlClientProvider
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'it',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    },
    status: 'authenticated',
  }),
  signIn: jest.fn(),
  signOut: jest.fn(),
}))

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}))

// Mock Mantine notifications
jest.mock('@mantine/notifications', () => ({
  showNotification: jest.fn(),
  hideNotification: jest.fn(),
}))

// Note: React Query is NOT mocked - tests use real QueryClient/QueryClientProvider
// This allows proper testing of data fetching hooks

// Global test utilities
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})
