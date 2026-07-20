import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface GenerationState {
  [pageId: string]: boolean
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

  // Memoize so the value identity only changes when `generating` changes —
  // otherwise every consumer re-renders on any parent render.
  const value = useMemo(() => ({
    generating,
    setGenerating,
    isAnyGenerating: Object.values(generating).some(Boolean),
  }), [generating, setGenerating])

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  )
}

export function useGeneration() {
  return useContext(GenerationContext)
}

export function usePageGeneration(pageId: string) {
  const { generating, setGenerating } = useGeneration()
  return {
    isGenerating: generating[pageId] ?? false,
    startGenerating: () => setGenerating(pageId, true),
    stopGenerating:  () => setGenerating(pageId, false),
  }
}
