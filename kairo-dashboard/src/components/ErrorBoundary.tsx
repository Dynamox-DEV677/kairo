/**
 * ErrorBoundary — stops one crashing page from white-screening the whole app.
 *
 * React unmounts the entire tree on an uncaught render error. Before this,
 * Kyno had no boundary anywhere (main.tsx only *reports* errors via
 * window.onerror), so a single bad `.map` on undefined or a corrupt
 * JSON.parse took down the entire SPA with a blank screen and no recovery.
 *
 * Wrapping the routed page area in this boundary converts that into a calm,
 * recoverable fallback while the sidebar / bottom-nav (rendered outside the
 * boundary) stay alive so the user can navigate away.
 */
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message?: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message ? String(err.message) : undefined }
  }

  componentDidCatch(error: any, info: any) {
    // Best-effort report to the ops dashboard — never let the reporter throw.
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
    } catch { /* ignore */ }
  }

  private goHome = () => {
    // Switch to Home first (Dashboard exposes setActive globally), then clear
    // the error so we don't just re-render the same crashing page.
    try {
      const setActive = (window as any).__kairoSetActive
      if (typeof setActive === 'function') setActive('home')
    } catch { /* ignore */ }
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
          background: 'rgba(79,124,255,0.12)',
          border: '1px solid rgba(102,217,255,0.25)',
          fontSize: 30,
        }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>This screen hit a snag</div>
        <p style={{ margin: 0, maxWidth: 380, fontSize: 13.5, lineHeight: 1.55, color: '#9CA3AF' }}>
          Kyno caught the problem before it took down the rest of the app. Your data is safe on
          this device. Head back home, or reload if it keeps happening.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
          <button
            onClick={this.goHome}
            style={{
              padding: '11px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #4F7CFF 0%, #2046C2 100%)',
              color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              boxShadow: '0 6px 18px rgba(79,124,255,0.28)',
            }}
          >Back to Home</button>
          <button
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
