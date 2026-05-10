import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { UpdatePasswordForm } from '@/components/update-password-form'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

const mockCreateClient = vi.mocked(createClient)

describe('UpdatePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('calls updateUser, signs out, and redirects to /auth/login on success', async () => {
    const mockUpdateUser = vi.fn().mockResolvedValue({ error: null })
    const mockSignOut = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockReturnValue({
      auth: { updateUser: mockUpdateUser, signOut: mockSignOut },
    } as any)

    render(<UpdatePasswordForm />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpassword123' })
      expect(mockSignOut).toHaveBeenCalledOnce()
      expect(mockPush).toHaveBeenCalledWith('/auth/login')
    })
  })

  it('shows error and does not redirect when updateUser fails', async () => {
    const mockUpdateUser = vi.fn().mockResolvedValue({
      error: { message: 'Auth session missing!' },
    })
    const mockSignOut = vi.fn()
    mockCreateClient.mockReturnValue({
      auth: { updateUser: mockUpdateUser, signOut: mockSignOut },
    } as any)

    render(<UpdatePasswordForm />)
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpassword123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Auth session missing!')
    })
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
