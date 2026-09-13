import { useSyncExternalStore } from 'react'
import { subscribeCatalogReadiness, getCatalogReadinessSnapshot, type CatalogReadinessState } from './catalogReadiness'

export function useCatalogReadiness(): CatalogReadinessState {
  return useSyncExternalStore(subscribeCatalogReadiness, getCatalogReadinessSnapshot)
}
