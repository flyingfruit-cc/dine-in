// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AvailabilitySchedule } from '@/components/admin/AvailabilitySchedule'
import type { AvailabilitySchedule as Schedule } from '@/types/app'

const sampleSchedule: Schedule = {
  days: ['mon', 'fri'],
  start_time: '11:00',
  end_time: '14:00',
}

describe('AvailabilitySchedule', () => {
  afterEach(() => cleanup())

  it('renders enable checkbox unchecked when schedule is null', () => {
    render(<AvailabilitySchedule schedule={null} onChange={vi.fn()} />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(false)
  })

  it('does not render day buttons or time inputs when schedule is null', () => {
    render(<AvailabilitySchedule schedule={null} onChange={vi.fn()} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByDisplayValue('11:00')).toBeNull()
  })

  it('renders enable checkbox checked when schedule is active', () => {
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={vi.fn()} />)
    const checkbox = screen.getByRole('checkbox')
    expect((checkbox as HTMLInputElement).checked).toBe(true)
  })

  it('renders 7 day buttons when schedule is active', () => {
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
  })

  it('marks active days with aria-pressed=true', () => {
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={vi.fn()} />)
    const monBtn = screen.getByRole('button', { name: 'Mon' })
    const tueBtn = screen.getByRole('button', { name: 'Tue' })
    expect((monBtn as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true')
    expect((tueBtn as HTMLButtonElement).getAttribute('aria-pressed')).toBe('false')
  })

  it('renders From and Until time inputs with schedule values', () => {
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('11:00')).toBeTruthy()
    expect(screen.getByDisplayValue('14:00')).toBeTruthy()
  })

  it('calls onChange with default schedule when enable checkbox is checked from null', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledOnce()
    const arg: Schedule = onChange.mock.calls[0][0]
    expect(arg).not.toBeNull()
    expect(arg.start_time).toBe('09:00')
    expect(arg.end_time).toBe('17:00')
    expect(Array.isArray(arg.days)).toBe(true)
  })

  it('calls onChange with null when enable checkbox is unchecked', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('adds a day when an inactive day button is clicked', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }))
    expect(onChange).toHaveBeenCalledOnce()
    const arg: Schedule = onChange.mock.calls[0][0]
    expect(arg.days).toContain('wed')
    expect(arg.days).toContain('mon')
    expect(arg.days).toContain('fri')
  })

  it('removes a day when an active day button is clicked', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }))
    expect(onChange).toHaveBeenCalledOnce()
    const arg: Schedule = onChange.mock.calls[0][0]
    expect(arg.days).not.toContain('mon')
    expect(arg.days).toContain('fri')
  })

  it('calls onChange with updated start_time when From input changes', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={onChange} />)
    const fromInput = screen.getByDisplayValue('11:00')
    fireEvent.change(fromInput, { target: { value: '09:00' } })
    expect(onChange).toHaveBeenCalledOnce()
    const arg: Schedule = onChange.mock.calls[0][0]
    expect(arg.start_time).toBe('09:00')
    expect(arg.end_time).toBe('14:00')
  })

  it('calls onChange with updated end_time when Until input changes', () => {
    const onChange = vi.fn()
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={onChange} />)
    const untilInput = screen.getByDisplayValue('14:00')
    fireEvent.change(untilInput, { target: { value: '16:30' } })
    expect(onChange).toHaveBeenCalledOnce()
    const arg: Schedule = onChange.mock.calls[0][0]
    expect(arg.end_time).toBe('16:30')
    expect(arg.start_time).toBe('11:00')
  })

  it('shows time-order warning when start_time >= end_time', () => {
    const badSchedule: Schedule = { days: ['mon'], start_time: '14:00', end_time: '11:00' }
    render(<AvailabilitySchedule schedule={badSchedule} onChange={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toContain('Start time must be before end time')
  })

  it('does not show time-order warning when start_time < end_time', () => {
    render(<AvailabilitySchedule schedule={sampleSchedule} onChange={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
