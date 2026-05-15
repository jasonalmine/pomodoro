// Minimal markdown renderer for AI-generated review text.
// Handles: ## headers, ### headers, **bold**, *italic*, `code`, and `- ` list items.
// Anything else falls through as a paragraph. Deliberately tiny — no deps.

import { Fragment } from 'react'

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'p'; text: string }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: 'p', text: para.join(' ').trim() })
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      blocks.push({ kind: 'ul', items: list })
      list = []
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushPara(); flushList(); continue }
    if (line.startsWith('## ')) { flushPara(); flushList(); blocks.push({ kind: 'h2', text: line.slice(3).trim() }); continue }
    if (line.startsWith('### ')) { flushPara(); flushList(); blocks.push({ kind: 'h3', text: line.slice(4).trim() }); continue }
    const listMatch = line.match(/^[-*]\s+(.*)$/)
    if (listMatch) { flushPara(); list.push(listMatch[1]); continue }
    flushList()
    para.push(line)
  }
  flushPara(); flushList()
  return blocks
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let i = 0
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) out.push(text.slice(i, m.index))
    if (m[1]) out.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3]) out.push(<em key={key++}>{m[4]}</em>)
    else if (m[5]) out.push(<code key={key++} className="font-mono text-[0.85em] bg-ink-100 dark:bg-ink-800 rounded px-1 py-0.5">{m[6]}</code>)
    i = m.index + m[0].length
  }
  if (i < text.length) out.push(text.slice(i))
  return out
}

export function MarkdownLite({ source }: { source: string }) {
  const blocks = parseBlocks(source)
  return (
    <div className="space-y-3 text-sm text-ink-800 dark:text-ink-100 leading-relaxed">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h2':
            return (
              <h3 key={i} className="font-display text-base text-ink-900 dark:text-ink-50 mt-4 first:mt-0">
                {renderInline(b.text)}
              </h3>
            )
          case 'h3':
            return (
              <h4 key={i} className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500 mt-3">
                {renderInline(b.text)}
              </h4>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc list-outside ml-5 space-y-1">
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </ul>
            )
          case 'p':
            return (
              <p key={i}>
                {renderInline(b.text).map((node, j) => <Fragment key={j}>{node}</Fragment>)}
              </p>
            )
        }
      })}
    </div>
  )
}
