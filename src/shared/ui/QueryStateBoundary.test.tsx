// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(cleanup)
import { QueryStateBoundary, toQueryState } from './QueryStateBoundary'

describe('QueryStateBoundary', () => {
  it('loading state: renders status region with aria-label Loading', () => {
    render(
      <QueryStateBoundary state="loading">
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByText('Children')).toBeNull()
  })

  it('loading state: renders custom skeleton when provided', () => {
    render(
      <QueryStateBoundary state="loading" skeleton={<div data-testid="custom-skel" />}>
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByTestId('custom-skel')).toBeTruthy()
  })

  it('error state: renders ErrorState heading', () => {
    render(
      <QueryStateBoundary state="error" onRetry={vi.fn()}>
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByRole('heading')).toBeTruthy()
    expect(screen.queryByText('Children')).toBeNull()
  })

  it('error state: shows error message from error prop', () => {
    render(
      <QueryStateBoundary state="error" error={new Error('Network failure')}>
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByText('Network failure')).toBeTruthy()
  })

  it('empty state: renders empty title', () => {
    render(
      <QueryStateBoundary
        state="empty"
        empty={{ title: 'No leads yet', body: 'Create one to get started.' }}
      >
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByText('No leads yet')).toBeTruthy()
    expect(screen.queryByText('Children')).toBeNull()
  })

  it('empty state: defaults title when empty config omitted', () => {
    render(
      <QueryStateBoundary state="empty">
        <div>Children</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByRole('heading')).toBeTruthy()
  })

  it('ready state: renders children', () => {
    render(
      <QueryStateBoundary state="ready">
        <div>Children visible</div>
      </QueryStateBoundary>,
    )
    expect(screen.getByText('Children visible')).toBeTruthy()
  })

  it('ready state: does NOT render loading/error/empty UI', () => {
    render(
      <QueryStateBoundary state="ready">
        <div>OK</div>
      </QueryStateBoundary>,
    )
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('toQueryState helper', () => {
  it('returns loading when isLoading=true', () => {
    expect(toQueryState(undefined, true, false)).toBe('loading')
  })

  it('returns error when isError=true and not loading', () => {
    expect(toQueryState(undefined, false, true)).toBe('error')
  })

  it('returns empty when data is undefined and not loading/error', () => {
    expect(toQueryState(undefined, false, false)).toBe('empty')
  })

  it('returns empty when data is an empty array', () => {
    expect(toQueryState([], false, false)).toBe('empty')
  })

  it('returns ready when data has at least one item', () => {
    expect(toQueryState([{ id: '1' }], false, false)).toBe('ready')
  })

  it('loading takes priority over error', () => {
    expect(toQueryState(undefined, true, true)).toBe('loading')
  })
})
