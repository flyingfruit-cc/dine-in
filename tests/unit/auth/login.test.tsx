import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { LoginForm } from '@/components/login-form'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}))

const mockCreateClient = vi.mocked(createClient)

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects to /admin on successful login', async () => {
    mockCreateClient.mockReturnValue({
      auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }) },
    } as any)

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin')
    })
  })

  it('shows friendly error for invalid credentials and preserves email', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid login credentials', status: 400 },
        }),
      },
    } as any)

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Incorrect email or password — tap to try again'
      )
    })
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('test@example.com')
  })

  it('shows generic error for unexpected failures', async () => {
    mockCreateClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Connection timeout', status: 503 },
        }),
      },
    } as any)

    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Something went wrong. Please try again.'
      )
    })
  })
})
