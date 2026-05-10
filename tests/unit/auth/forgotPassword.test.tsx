import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { ForgotPasswordForm } from '@/components/forgot-password-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

const mockCreateClient = vi.mocked(createClient)

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('calls resetPasswordForEmail with PKCE confirm redirect and shows success state', async () => {
    const mockReset = vi.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockReturnValue({
      auth: { resetPasswordForEmail: mockReset },
    } as any)

    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith(
        'owner@example.com',
        { redirectTo: expect.stringContaining('/auth/confirm?next=/auth/update-password') }
      )
    })
    expect(screen.getByText('Check your email')).toBeDefined()
  })

  it('shows error message when resetPasswordForEmail fails', async () => {
    const mockReset = vi.fn().mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    })
    mockCreateClient.mockReturnValue({
      auth: { resetPasswordForEmail: mockReset },
    } as any)

    render(<ForgotPasswordForm />)
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Rate limit exceeded')
    })
  })
})
