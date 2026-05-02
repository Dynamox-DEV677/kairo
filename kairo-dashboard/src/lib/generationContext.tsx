/**
 * Generation Context
 * ──────────────────
 * Tracks which pages are currently generating AI content.
 * Shows a subtle pulsing indicator on the sidebar item when a background
 * generation is running on a page the user isn't currently viewing.
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface GenerationState {
  [pageId: string]: boolean  // true = currently generating
}

interface GenerationContextType {
  generating: GenerationState
  setGenerating: (pageId: string, isGenerating: boolean) => void
  isAnyGenerating: boolean
}

const GenerationContext = createContext<GenerationContextType>({
  generating: {},
  setGenerating: () => {},
  isAnyGenerating: false,
})

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [generating, setGeneratingState] = useState<GenerationState>({})

  const setGenerating = useCallback((pageId: string, isGenerating: boolean) => {
    setGeneratingState(prev => ({ ...prev, [pageId]: isGenerating }))
  }, [])

  const isAnyGenerating = Object.values(generating).some(Boolean)

  return (
    <GenerationContext.Provider value={{ generating, setGenerating, isAnyGenerating }}>
      {children}
    </GenerationContext.Provider>
  )
}

export function useGeneration() {
  return useContext(GenerationContext)
}

/** Hook for individual pages to report their generation status */
export function usePageGeneration(pageId: string) {
  const { generating, setGenerating } = useGeneration()
  return {
    isGenerating: generating[pageId] ?? false,
    startGenerating: () => setGenerating(pageId, true),
    stopGenerating:  () => setGenerating(pageId, false),
  }
}
