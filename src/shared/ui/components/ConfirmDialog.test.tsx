// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(cleanup)
import { ConfirmDialog } from './ConfirmDialog'

const baseProps = {
  open: true,
  title: 'Delete record',
  body: 'This action cannot be undone.',
  confirmLabel: 'Delete',
  tone: 'danger' as const,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmDialog', () => {
  it('renders title and body when open', () => {
    render(<ConfirmDialog {...baseProps} />)
    expect(screen.getByText('Delete record')).toBeTruthy()
    expect(screen.getByText('This action cannot be undone.')).toBeTruthy()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape key is pressed', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when clicking the backdrop (outside dialog)', () => {
    const onCancel = vi.fn()
    const { container } = render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    // The outer div is the scrim; click on it directly
    const scrim = container.firstChild as HTMLElement
    fireEvent.click(scrim, { target: scrim })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('Cancel button is not the confirm button — danger confirm never default-focused', () => {
    render(<ConfirmDialog {...baseProps} tone="danger" />)
    const cancelBtn = screen.getByText('Cancel').closest('button')!
    const confirmBtn = screen.getByText('Delete').closest('button')!
    // Cancel gets ref and is the safe default focus; confirm must NOT have autofocus
    expect(confirmBtn.getAttribute('autofocus')).toBeNull()
    expect(confirmBtn).not.toBe(document.activeElement)
    expect(cancelBtn).toBeDefined()
  })

  it('scrim uses CSS token variables, not hardcoded rgba', () => {
    const { container } = render(<ConfirmDialog {...baseProps} />)
    const scrim = container.firstChild as HTMLElement
    // background should be set via CSS variable reference (getComputedStyle in jsdom returns empty for CSS vars)
    // Check the inline style attribute instead
    const bgStyle = scrim.style.background
    expect(bgStyle).toBe('var(--crm-scrim)')
  })

  it('backdrop-filter uses CSS token, not hardcoded blur()', () => {
    const { container } = render(<ConfirmDialog {...baseProps} />)
    const scrim = container.firstChild as HTMLElement
    expect(scrim.style.backdropFilter).toBe('var(--crm-backdrop-blur)')
  })

  it('has role=dialog and aria-modal=true', () => {
    render(<ConfirmDialog {...baseProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('dialog is labelled by title (aria-labelledby)', () => {
    render(<ConfirmDialog {...baseProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-dialog-title')
  })
})
