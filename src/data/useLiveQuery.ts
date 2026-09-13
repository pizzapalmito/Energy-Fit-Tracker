import { liveQuery } from 'dexie'
import { useEffect, useState, type DependencyList } from 'react'

export type LiveQueryState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; value: T }

/**
 * Thin wrapper around Dexie's own `liveQuery` (no dexie-react-hooks
 * dependency needed): re-runs `querier` whenever any Dexie table it read
 * changes, so views stay current without polling. `deps` controls when the
 * subscription itself is re-created (mirrors useEffect's dependency array).
 */
export function useLiveQuery<T>(querier: () => Promise<T>, deps: DependencyList): LiveQueryState<T> {
  const [state, setState] = useState<LiveQueryState<T>>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    const subscription = liveQuery(querier).subscribe({
      next: (value) => setState({ status: 'ready', value }),
      error: (error: unknown) => setState({ status: 'error', message: error instanceof Error ? error.message : 'Query failed.' }),
    })
    return () => subscription.unsubscribe()
  }, deps)

  return state
}
