import React from 'react'
import { Skeleton } from './components/Skeleton'
import { EmptyState } from './components/EmptyState'
import { ErrorState } from './components/ErrorState'

export type QueryState = 'loading' | 'empty' | 'error' | 'ready'

type EmptyConfig = {
  icon?: string
  title?: string
  body?: string
  scopeLine?: string
  action?: { label: string; icon?: string; onClick: () => void }
}

type QueryStateBoundaryProps = {
  state: QueryState
  error?: Error | null
  empty?: EmptyConfig
  skeleton?: React.ReactNode
  children: React.ReactNode
  onRetry?: () => void
}

export function QueryStateBoundary({
  state,
  error,
  empty,
  skeleton,
  children,
  onRetry,
}: QueryStateBoundaryProps) {
  if (state === 'loading') {
    return (
      <div role="status" aria-label="Loading">
        {skeleton ?? (
          <div style={{ padding: 'var(--iso-space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--iso-space-3)' }}>
            <Skeleton w="60%" h={16} />
            <Skeleton w="80%" h={12} />
            <Skeleton w="45%" h={12} />
            <Skeleton w="70%" h={12} />
            <Skeleton w="55%" h={12} />
          </div>
        )}
      </div>
    )
  }

  if (state === 'error') {
    return (
      <ErrorState
        title={error?.message ?? "Can't load data"}
        onRetry={onRetry}
      />
    )
  }

  if (state === 'empty') {
    return (
      <EmptyState
        icon={empty?.icon}
        title={empty?.title ?? 'Nothing here yet'}
        body={empty?.body ?? 'Records will appear here once they exist.'}
        scopeLine={empty?.scopeLine}
        action={empty?.action}
      />
    )
  }

  return <>{children}</>
}

/**
 * Converts TanStack Query state to QueryState for use with QueryStateBoundary.
 * Feature hooks call this to bridge TanStack Query state without coupling the
 * boundary component to @tanstack/react-query.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function toQueryState<T>(
  data: T[] | undefined,
  isLoading: boolean,
  isError: boolean,
): QueryState {
  if (isLoading) return 'loading'
  if (isError) return 'error'
  if (!data || data.length === 0) return 'empty'
  return 'ready'
}
