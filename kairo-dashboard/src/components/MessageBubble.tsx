import { motion } from 'framer-motion'
import { GraduationCap, User } from 'lucide-react'
import ActionChips from './ActionChips'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: string
}

interface MessageBubbleProps {
  message: Message
  isLast: boolean
  isStreaming: boolean
  onChipAction: (action: string, content: string) => void
}

export default function MessageBubble({ message, isLast, isStreaming, onChipAction }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 24,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, #374151, #1f2937)'
          : 'linear-gradient(135deg, #6366f1, #7c3aed)',
        border: isUser ? '1px solid #27272a' : '1px solid rgba(99,102,241,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isUser ? 'none' : '0 0 12px rgba(99,102,241,0.25)',
        marginTop: 2,
      }}>
        {isUser
          ? <User size={14} color="#9ca3af" />
          : <GraduationCap size={14} color="#fff" />
        }
      </div>

      {/* Bubble content */}
      <div style={{ maxWidth: '72%', minWidth: 60 }}>
        {/* Role label */}
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#3f3f46',
          textTransform: 'uppercase', letterSpacing: 0.8,
          marginBottom: 6,
          textAlign: isUser ? 'right' : 'left',
        }}>
          {isUser ? 'You' : 'Kairo AI'}
        </div>

        {/* Bubble */}
        <div style={{
          padding: isUser ? '11px 16px' : '14px 18px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser
            ? 'linear-gradient(135deg, #1e1e2e, #16162a)'
            : '#111111',
          border: isUser
            ? '1px solid #2d2d3d'
            : '1px solid #1e1e1e',
          boxShadow: isUser
            ? '0 4px 20px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(0,0,0,0.2)',
          position: 'relative',
        }}>
          {isUser ? (
            <p style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.6, margin: 0 }}>
              {message.content}
            </p>
          ) : (
            <div className="prose-ai">
              <div dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }} />
              {isStreaming && isLast && (
                <span className="animate-blink" style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#818cf8', borderRadius: 1, marginLeft: 2, verticalAlign: 'text-bottom',
                }} />
              )}
            </div>
          )}
        </div>

        {/* Action chips — only on completed AI messages */}
        {!isUser && !isStreaming && message.content && (
          <ActionChips
            onSimpler={() => onChipAction('simpler', message.content)}
            onFlashcards={() => onChipAction('flashcards', message.content)}
            onSaveNotes={() => onChipAction('notes', message.content)}
            onExamQuestions={() => onChipAction('exam', message.content)}
            onRegenerate={() => onChipAction('regenerate', message.content)}
          />
        )}
      </div>
    </motion.div>
  )
}

// Minimal markdown-to-HTML converter (bold, italic, headings, bullets, code)
function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // code blocks
    .replace(/```[\s\S]*?```/g, (m) => `<pre><code>${m.slice(3, -3).trim()}</code></pre>`)
    // headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bullets
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    // numbered list
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huplo]|<\/[huplo])(.+)$/gm, (line) =>
      line.startsWith('<') ? line : `<p>${line}</p>`
    )
}
