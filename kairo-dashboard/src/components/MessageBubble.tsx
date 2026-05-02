import { motion } from 'framer-motion'
import { User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        background: isUser ? 'linear-gradient(135deg, #374151, #1f2937)' : '#000',
        border: isUser ? '1px solid #27272a' : '1px solid #2a2a2a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isUser ? 'none' : '0 0 12px rgba(99,102,241,0.2)',
        marginTop: 2, overflow: 'hidden',
      }}>
        {isUser
          ? <User size={14} color="#9ca3af" />
          : <img src="/kairo_logo.png" alt="K" style={{ width: 22, height: 22, objectFit: 'contain' }} />
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
          background: isUser ? 'linear-gradient(135deg, #1e1e2e, #16162a)' : '#111111',
          border: isUser ? '1px solid #2d2d3d' : '1px solid #1e1e1e',
          boxShadow: isUser ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.2)',
          position: 'relative',
        }}>
          {isUser ? (
            <p style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.6, margin: 0 }}>
              {message.content}
            </p>
          ) : (
            <div style={{ fontSize: 14, color: '#d4d4d8', lineHeight: 1.7 }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p style={{ margin: '0 0 10px', lineHeight: 1.7 }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fafafa', margin: '14px 0 8px' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 700, color: '#e4e4e7', margin: '12px 0 6px' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 700, color: '#a1a1aa', margin: '10px 0 4px' }}>{children}</h3>,
                  strong: ({ children }) => <strong style={{ color: '#fafafa', fontWeight: 700 }}>{children}</strong>,
                  em: ({ children }) => <em style={{ color: '#c4b5fd' }}>{children}</em>,
                  ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: '6px 0 10px' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: '6px 0 10px' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: 4, color: '#d4d4d8' }}>{children}</li>,
                  code: ({ children, className }) => {
                    const isBlock = !!className
                    return isBlock
                      ? <pre style={{ background: '#0a0a0a', border: '1px solid #27272a', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', margin: '10px 0' }}>
                          <code style={{ fontSize: 13, color: '#86efac', fontFamily: 'monospace' }}>{children}</code>
                        </pre>
                      : <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: 4, fontSize: 13, color: '#c4b5fd', fontFamily: 'monospace' }}>{children}</code>
                  },
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th style={{ padding: '8px 12px', background: '#1a1a2e', color: '#818cf8', fontWeight: 700, border: '1px solid #27272a', textAlign: 'left' }}>{children}</th>,
                  td: ({ children }) => <td style={{ padding: '7px 12px', border: '1px solid #1e1e1e', color: '#d4d4d8', verticalAlign: 'top' }}>{children}</td>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #6366f1', paddingLeft: 12, margin: '8px 0', color: '#a1a1aa', fontStyle: 'italic' }}>{children}</blockquote>,
                  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #27272a', margin: '12px 0' }} />,
                  a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>{children}</a>,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && isLast && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#818cf8', borderRadius: 1, marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'blink 1s step-end infinite',
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
