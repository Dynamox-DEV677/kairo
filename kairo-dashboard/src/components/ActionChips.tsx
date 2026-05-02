import { motion } from 'framer-motion'
import { BookMarked, FileText, Target, RotateCcw, Lightbulb } from 'lucide-react'

interface ActionChipsProps {
  onSimpler: () => void
  onFlashcards: () => void
  onSaveNotes: () => void
  onExamQuestions: () => void
  onRegenerate: () => void
}

const CHIPS = [
  { icon: Lightbulb, label: 'Explain simpler', key: 'simpler', color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
  { icon: BookMarked, label: 'Make flashcards', key: 'flashcards', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
  { icon: FileText, label: 'Save as notes', key: 'notes', color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.2)' },
  { icon: Target, label: 'Exam questions', key: 'exam', color: '#f472b6', bg: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.2)' },
  { icon: RotateCcw, label: 'Regenerate', key: 'regen', color: '#71717a', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.2)' },
]

export default function ActionChips({ onSimpler, onFlashcards, onSaveNotes, onExamQuestions, onRegenerate }: ActionChipsProps) {
  const handlers: Record<string, () => void> = {
    simpler: onSimpler,
    flashcards: onFlashcards,
    notes: onSaveNotes,
    exam: onExamQuestions,
    regen: onRegenerate,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.3 }}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}
    >
      {CHIPS.map((chip, i) => (
        <motion.button
          key={chip.key}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.05 }}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handlers[chip.key]}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 20,
            background: chip.bg, border: `1px solid ${chip.border}`,
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 500, color: chip.color,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${chip.border}`
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
          }}
        >
          <chip.icon size={11} />
          {chip.label}
        </motion.button>
      ))}
    </motion.div>
  )
}
