import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /**
   * Changes when the user navigates. When it changes we clear any stale error
   * so a crash on one page does not stick across every tab — WITHOUT using
   * `key`, which would remount the whole page subtree on every navigation and
   * wipe live in-memory state (the Study Room's channel and membership, for
   * one). Clearing state here keeps the pages mounted.
   */
  resetKey?: string | number
}
interface State { hasError: boolean; message?: string; lastKey?: string | number }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: any): Partial<State> {
    return { hasError: true, message: err?.message ? String(err.message) : undefined }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Navigation happened: forget the previous page's error, keep children mounted.
    if (props.resetKey !== state.lastKey) {
      return { hasError: false, message: undefined, lastKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: any, info: any) {
    try {
      fetch('/api/ops/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'React render crash: ' + (error?.message || String(error)).slice(0, 300),
          page: location.pathname + location.hash,
          stack: (error?.stack || '').slice(0, 1200),
          componentStack: (info?.componentStack || '').slice(0, 1200),
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      }).catch(() => {})
    } catch {  }
  }

  private goHome = () => {
    try {
      const setActive = (window as any).__kairoSetActive
      if (typeof setActive === 'function') setActive('home')
    } catch {  }
    this.setState({ hasError: false, message: undefined })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        flex: 1, minHeight: 0, width: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '40px 24px', textAlign: 'center',
        color: '#fafafa',
        fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          display: 'grid', placeItems: 'center',
          background: 'rgba(124, 92, 255,0.12)',
          border: '1px solid rgba(165,180,252,0.25)',
          fontSize: 30,
        }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>This screen hit a snag</div>
        <p style={{ margin: 0, maxWidth: 380, fontSize: 13.5, lineHeight: 1.55, color: '#9CA3AF' }}>
          Kyno caught the problem before it took down the rest of the app. Your data is safe on
          this device. Head back home, or reload if it keeps happening.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button className="kyno-chunky"
            onClick={this.goHome}
            style={{
              padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7C5CFF 0%, #4A2FA8 100%)',
              color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              boxShadow: '0 6px 18px rgba(124, 92, 255,0.28)',
            }}
          >Back to Home</button>
          <button className="kyno-ghost"
            onClick={() => location.reload()}
            style={{
              padding: '11px 20px', borderRadius: 12, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.14)',
              color: '#C7D2E8', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            }}
          >Reload Kyno</button>
        </div>
      </div>
    )
  }
}
