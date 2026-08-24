import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Printer, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { chat } from '../lib/openrouter'
import { prepMathMarkdown } from '../lib/math.core'

const SYSTEM = `You are an expert question paper setter for Indian school board exams.
Create a complete board-standard paper with:
**[SCHOOL NAME]** · **Class [X] – [Subject]** · **Time: [X] Hours    Max Marks: [X]**
---
**General Instructions:** [5 standard instructions]
---
**Section A** *(MCQs – 1 mark each)*
**Q1.** ... (a) ... (b) ... (c) ... (d) ...
[10 MCQs]
---
**Section B** *(Short Answer – 2 marks each)*
[5 questions]
---
**Section C** *(Long Answer – 5 marks each)*
[4 questions]
---
*End of Question Paper*
Make all questions accurate and board-standard.`

const sel = (v: string, set: (v: string) => void, opts: string[]) => (
  <select value={v} onChange={e => set(e.target.value)}
    style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none', appearance: 'none' }}>
    {opts.map(o => <option key={o}>{o}</option>)}
  </select>
)

const PAPER_CSS = `
  .qp-paper { font-family: 'Times New Roman', Times, serif; font-size: 14px; line-height: 1.8; color: #171D2D; }
  .qp-paper p { margin: 5px 0; }
  .qp-paper h1, .qp-paper h2, .qp-paper h3 { text-align: center; margin: 4px 0; font-family: inherit; }
  .qp-paper h1 { font-size: 17px; text-transform: uppercase; letter-spacing: 1px; }
  .qp-paper h2 { font-size: 15px; }
  .qp-paper hr { border: none; border-top: 1.5px solid #171D2D; margin: 12px 0; }
  .qp-paper ul, .qp-paper ol { margin: 4px 0 4px 22px; padding: 0; }
  .qp-paper li { margin: 3px 0; }
  .qp-paper table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  .qp-paper th, .qp-paper td { border: 1px solid #333; padding: 6px 10px; }
  .qp-paper th { background: #f0f0f0; font-weight: 700; }
`

export default function QuestionPaper() {
  const [school, setSchool] = useState('Delhi Public School')
  const [subject, setSubject] = useState('Mathematics')
  const [cls, setCls] = useState('10')
  const [board, setBoard] = useState('CBSE')
  const [totalMarks, setTotalMarks] = useState('80')
  const [duration, setDuration] = useState('3')
  const [topics, setTopics] = useState('')
  const [difficulty, setDifficulty] = useState('Mixed')
  const [paper, setPaper] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true); setError(''); setPaper('')
    try {
      const r = await chat({ messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${totalMarks}-mark, ${duration}-hour ${board} Class ${cls} ${subject} paper. School: ${school}. Topics: ${topics || 'Full syllabus'}. Difficulty: ${difficulty}.` }] })
      setPaper(r)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  function printPaper() {
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>${subject} Paper</title><style>body{font-family:'Times New Roman',serif;font-size:13px;line-height:1.8;padding:40px 56px;max-width:800px;margin:0 auto;}h1,h2,h3{text-align:center;margin:4px 0;}h1{font-size:16px;text-transform:uppercase;}hr{border-top:1.5px solid #000;margin:12px 0;}ul,ol{margin:4px 0 4px 22px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #333;padding:5px 8px;}th{background:#eee;}</style></head><body></body></html>`)
    w.document.close()
    const el = w.document.body
    const src = document.getElementById('qp-render')
    if (el && src) el.innerHTML = src.innerHTML
    setTimeout(() => w.print(), 400)
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 960, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <style>{PAPER_CSS}</style>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', margin: 0 }}>Question Paper Generator</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Board-standard papers in under 2 minutes</p>
      </div>

      {!paper && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#141A2A', border: '1px solid #1f2532', borderRadius: 14, padding: 28 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>School name</label>
              <input value={school} onChange={e => setSchool(e.target.value)} style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Board</label>
              {sel(board, setBoard, ['CBSE','ICSE','Maharashtra','Tamil Nadu','Karnataka','UP Board'])}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Subject</label>
              {sel(subject, setSubject, ['Mathematics','Physics','Chemistry','Biology','English','Hindi','History','Geography','Economics','Science','Computer Science'])}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Class</label>
              {sel(cls, setCls, ['6','7','8','9','10','11','12'])}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Total marks</label>
              {sel(totalMarks, setTotalMarks, ['20','25','40','50','80','100'])}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Duration (hours)</label>
              {sel(duration, setDuration, ['1','1.5','2','2.5','3','3.5'])}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>Topics (optional)</label>
            <input value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. Algebra, Geometry — leave blank for full syllabus"
              style={{ width: '100%', background: '#141A2A', border: '1px solid #1f2532', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fafafa', fontFamily: 'inherit', outline: 'none' }} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>Difficulty</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Easy','Medium','Hard','Mixed'].map(d => (
                <motion.button className="kyno-chip" key={d} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setDifficulty(d)}
                  style={{ padding: '6px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    background: difficulty === d ? 'rgba(124, 92, 255, 0.15)' : '#1C2233',
                    border: `1px solid ${difficulty === d ? '#7C5CFF' : '#1f2532'}`,
                    color: difficulty === d ? '#A5B4FC' : '#6B7280' }}>
                  {d}
                </motion.button>
              ))}
            </div>
          </div>

          {error && <p style={{ fontSize: 12, color: '#A5B4FC', marginBottom: 14 }}>{error}</p>}

          <motion.button className="kyno-chunky" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={generate}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #7C5CFF, #7C5CFF)', color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 0 20px rgba(124, 92, 255, 0.03)' }}>
            <Sparkles size={14} /> Generate question paper
          </motion.button>
        </motion.div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '2px solid #1f2532', borderTop: '2px solid #7C5CFF', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Generating your question paper…</p>
        </div>
      )}

      {paper && !loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#6B7280' }}>Your question paper is ready</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="kyno-ghost" onClick={() => setPaper('')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, background: '#1C2233', border: '1px solid #1f2532', color: '#9CA3AF', cursor: 'pointer', fontFamily: 'inherit' }}>
                <RotateCcw size={12} /> Regenerate
              </button>
              <button className="kyno-chunky" onClick={printPaper} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12, background: '#7C5CFF', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                <Printer size={12} /> Print / PDF
              </button>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 40px rgba(0,0,0,0.4)', padding: '48px 56px' }}>
            <div id="qp-render" className="qp-paper">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{prepMathMarkdown(paper)}</ReactMarkdown>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
