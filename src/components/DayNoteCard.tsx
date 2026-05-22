import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, startOfDay } from 'date-fns'
import { Notebook } from 'lucide-react'
import { db } from '../db'
import type { DayNote } from '../types'

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

// Free-form scratchpad note for today. Auto-saves on blur and on a short
// debounce while typing, so it survives navigation / tab-close without a
// "save" button.
export function DayNoteCard({ now = new Date() }: { now?: Date }) {
  const id = dayKey(now)
  const existing = useLiveQuery(() => db.dayNotes.get(id), [id])
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const dirtyRef = useRef(false)
  const lastSavedRef = useRef('')

  // Seed from existing row once it loads; if user hasn't typed anything yet.
  useEffect(() => {
    if (dirtyRef.current) return
    setContent(existing?.content ?? '')
    lastSavedRef.current = existing?.content ?? ''
    if (existing?.updatedAt) setSavedAt(existing.updatedAt)
  }, [existing])

  const persist = async (next: string) => {
    if (next === lastSavedRef.current) return
    const ts = Date.now()
    const row: DayNote = {
      id,
      date: startOfDay(now).getTime(),
      content: next,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    }
    await db.dayNotes.put(row)
    lastSavedRef.current = next
    setSavedAt(ts)
    dirtyRef.current = false
  }

  // Debounced autosave while typing.
  useEffect(() => {
    if (!dirtyRef.current) return
    const t = setTimeout(() => { void persist(content) }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  const onChange = (v: string) => {
    dirtyRef.current = true
    setContent(v)
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Notebook size={18} className="text-accent mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Today's note</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Free-form scratchpad for the day — separate from per-session reflections. Auto-saves.
          </p>
        </div>
        {savedAt && (
          <span className="text-[11px] text-ink-400 tabular shrink-0">
            Saved {format(savedAt, 'h:mm a')}
          </span>
        )}
      </div>
      <textarea
        value={content}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (dirtyRef.current) void persist(content) }}
        rows={5}
        placeholder="What's on your mind today? A blocker, a half-formed idea, something to remember…"
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 resize-y focus:border-accent focus:ring-0 outline-none transition-colors leading-relaxed"
      />
    </section>
  )
}
