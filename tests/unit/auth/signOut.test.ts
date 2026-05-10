// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// server-only is a Next.js guard that throws in non-server bundler contexts;
// mock it so server actions can be imported in tests without error
vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// mock admin client to prevent server-only import from lib/supabase/admin
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { signOut } from '@/actions/authActions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const mockSignOut = vi.fn()

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signOut: mockSignOut,
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    } as any)
  })

  it('calls supabase.auth.signOut and redirects to /auth/login', async () => {
    await signOut()

    expect(mockSignOut).toHaveBeenCalledOnce()
    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/auth/login')
  })

  it('still redirects to /auth/login even when signOut errors', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'network error' } })

    await signOut()

    expect(vi.mocked(redirect)).toHaveBeenCalledWith('/auth/login')
  })
})
