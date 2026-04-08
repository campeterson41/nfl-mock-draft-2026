import { createContext, useContext } from 'react'
import { useDraftSimulator } from '../hooks/useDraftSimulator.js'

const DraftContext = createContext(null)

export function DraftProvider({ children, sessionConfig }) {
  const draft = useDraftSimulator(sessionConfig)
  return (
    <DraftContext.Provider value={draft}>
      {children}
    </DraftContext.Provider>
  )
}

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used within DraftProvider')
  return ctx
}
