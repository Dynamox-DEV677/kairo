const KEY = 'kyno:recent_chats'
const MAX = 15

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  id: string
}

export interface RecentChat {
  id: string
  title: string
  messages: ChatMessage[]
  updated: number
}

export function getRecentChats(): RecentChat[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.sort((a, b) => b.updated - a.updated)
  } catch { return [] }
}

export function saveRecentChat(chat: RecentChat): void {
  if (!chat.id || !chat.messages?.length) return
  try {
    const list = getRecentChats().filter(c => c.id !== chat.id)
    list.unshift(chat)
    const trimmed = list.slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(trimmed))
    window.dispatchEvent(new CustomEvent('kairo:recents-updated'))
  } catch (e) {
    console.warn('[recentChats] save failed', e)
  }
}

export function deleteRecentChat(id: string): void {
  try {
    const list = getRecentChats().filter(c => c.id !== id)
    localStorage.setItem(KEY, JSON.stringify(list))
    window.dispatchEvent(new CustomEvent('kairo:recents-updated'))
  } catch {}
}

export function clearRecentChats(): void {
  localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent('kairo:recents-updated'))
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(ms).toLocaleDateString()
}

export function makeTitle(firstMessage: string): string {
  const t = firstMessage.trim().replace(/\s+/g, ' ')
  return t.length > 50 ? t.slice(0, 50) + '…' : t
}
