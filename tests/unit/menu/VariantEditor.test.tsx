// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { VariantEditor } from '@/components/admin/VariantEditor'
import type { VariantGroup } from '@/types/app'

const sampleVariants: VariantGroup[] = [
  {
    id: 'g1',
    name: 'Size',
    options: [
      { id: 'o1', name: 'Small', price_cents: 800 },
      { id: 'o2', name: 'Large', price_cents: 1200 },
    ],
  },
]

describe('VariantEditor', () => {
  afterEach(() => { cleanup() })

  it('renders existing groups and options', () => {
    render(<VariantEditor variants={sampleVariants} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Size')).toBeTruthy()
    expect(screen.getByDisplayValue('Small')).toBeTruthy()
    expect(screen.getByDisplayValue('Large')).toBeTruthy()
    expect(screen.getByDisplayValue('8.00')).toBeTruthy()
    expect(screen.getByDisplayValue('12.00')).toBeTruthy()
  })

  it('renders empty state with Add variant group button', () => {
    render(<VariantEditor variants={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /add variant group/i })).toBeTruthy()
  })

  it('calls onChange with new group when Add variant group is clicked', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add variant group/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('')
    expect(result[0].options).toEqual([])
    expect(result[0].id).toBeTruthy()
  })

  it('calls onChange with new option when Add option is clicked', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add option/i }))
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result[0].options).toHaveLength(3)
    expect(result[0].options[2].name).toBe('')
    expect(result[0].options[2].price_cents).toBe(0)
  })

  it('calls onChange with group removed when remove group is clicked', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /remove group/i }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0]).toEqual([])
  })

  it('calls onChange with option removed when remove option is clicked', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    const removeButtons = screen.getAllByRole('button', { name: /remove option/i })
    fireEvent.click(removeButtons[0])
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result[0].options).toHaveLength(1)
    expect(result[0].options[0].id).toBe('o2')
  })

  it('disables Add option when group has 6 options', () => {
    const sixOptionGroup: VariantGroup[] = [
      {
        id: 'g1',
        name: 'Size',
        options: Array.from({ length: 6 }, (_, i) => ({
          id: `o${i}`,
          name: `Option ${i}`,
          price_cents: 0,
        })),
      },
    ]
    render(<VariantEditor variants={sixOptionGroup} onChange={vi.fn()} />)
    const addOption = screen.getByRole('button', { name: /add option/i })
    expect((addOption as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls onChange with updated group name on input change', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    const groupInput = screen.getByDisplayValue('Size')
    fireEvent.change(groupInput, { target: { value: 'Temperature' } })
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result[0].name).toBe('Temperature')
  })

  it('calls onChange with updated option name on input change', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    const optionInput = screen.getByDisplayValue('Small')
    fireEvent.change(optionInput, { target: { value: 'Regular' } })
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result[0].options[0].name).toBe('Regular')
  })

  it('calls onChange with updated price in cents on price change', () => {
    const onChange = vi.fn()
    render(<VariantEditor variants={sampleVariants} onChange={onChange} />)
    const priceInput = screen.getByDisplayValue('8.00')
    fireEvent.change(priceInput, { target: { value: '9.50' } })
    expect(onChange).toHaveBeenCalledOnce()
    const result: VariantGroup[] = onChange.mock.calls[0][0]
    expect(result[0].options[0].price_cents).toBe(950)
  })
})
