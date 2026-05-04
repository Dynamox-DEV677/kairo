let handler

try {
  const { default: app } = await import('../server/app.js')
  handler = app
} catch (err) {
  console.error('[Kairo] Server failed to start:', err)
  handler = (_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.status(500).json({
      error: 'Server initialization failed',
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 8),
    })
  }
}

export default handler
