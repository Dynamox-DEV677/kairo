/**
 * Harness for the Reader.
 *
 * Renders the real page against a real PDF, without a login. The ingest
 * pipeline, IndexedDB storage and the selection sheet all behave differently
 * with a genuine 11MB textbook than with fixtures, and every bug found here so
 * far (a worker that 404s after bundling, destroy() on the wrong object, lines
 * glued together) was invisible until one went through.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import Reader from './pages/Reader'
import './index.css'

/*
 * The root is created ONCE and reused.
 *
 * Vite re-executes this module on hot update (it exports no component, so Fast
 * Refresh bails and invalidates the whole file). A second createRoot() on the
 * same container warns and then renders into a root that is no longer the live
 * one -- the page goes blank with no error, which is exactly what happened.
 */
const el = document.getElementById('root')!
const w = window as unknown as { __readerRoot?: ReturnType<typeof createRoot> }
const root = w.__readerRoot ?? (w.__readerRoot = createRoot(el))

root.render(
  <div style={{ position: 'fixed', inset: 0 }}>
    <Reader />
  </div>,
)
