/**
 * Tiny helper any AI feature can call to auto-save its output to the notebook.
 * Fire-and-forget. Returns null on failure (auth not present, server down, etc.).
 */
export async function saveToNotebook(payload: {
  kind:    'flashcards' | 'summary' | 'doubt' | 'concept_map' | 'note' | 'plan' | 'grade'
  title:   string
  content: string
  subject?: string | null
  tags?:    string[]
  source?:  string
}): Promise<{ id: string } | null> {
  if (!localStorage.getItem('kairo_token')) return null
  try {
    const res = await fetch('/api/notebook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('kairo_token') || ''}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
