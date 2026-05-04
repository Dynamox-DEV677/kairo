// Lazy-load the Express app so import errors surface as JSON instead of crashing Vercel
export default async function handler(req, res) {
  try {
    const { default: app } = await import('../server/app.js')
    app(req, res)
  } catch (err) {
    console.error('[Kairo] Fatal startup error:', err)
    res.setHeader('Content-Type', 'application/json')
    res.status(500).json({
      error:   'Server failed to start',
      message: err.message,
      stack:   err.stack?.split('\n').slice(0, 10),
    })
  }
}
