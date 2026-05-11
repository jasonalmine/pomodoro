import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react'
import { db, PROJECT_COLORS } from '../db'
import { Button } from '../components/Button'
import type { Project } from '../types'

export function ProjectsView() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [], [])
  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Projects</h1>
          <p className="text-sm text-ink-500 mt-1">Organize what you focus on.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> New</Button>
      </header>

      {(creating || editing) && (
        <ProjectForm
          initial={editing}
          onCancel={() => { setCreating(false); setEditing(null) }}
          onSave={async (p) => {
            await db.projects.put(p)
            setCreating(false); setEditing(null)
          }}
        />
      )}

      <div className="space-y-2">
        {(projects ?? []).map(p => (
          <div key={p.id} className={`rounded-2xl border p-4 flex items-center gap-3 ${p.archived ? 'opacity-60 border-ink-200 dark:border-ink-800' : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            <button onClick={() => setEditing(p)} className="text-left flex-1 min-w-0">
              <div className="font-medium text-ink-900 dark:text-ink-100 truncate">{p.name}</div>
              {p.description && <div className="text-xs text-ink-500 truncate">{p.description}</div>}
            </button>
            <Button variant="ghost" size="sm" onClick={() => db.projects.update(p.id, { archived: !p.archived })}>
              {p.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (!confirm(`Delete project "${p.name}"? Past Pomodoros are kept.`)) return
              await db.projects.delete(p.id)
            }}>
              <Trash2 size={16} className="text-rose-500" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProjectForm({ initial, onSave, onCancel }: { initial: Project | null; onSave: (p: Project) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(initial?.description ?? '')

  const save = () => {
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      color,
      description: description.trim() || undefined,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? Date.now(),
    })
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <input
        value={name} onChange={e => setName(e.target.value)} placeholder="Project name" autoFocus
        className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-base dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
      />
      <input
        value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description"
        className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
      />
      <div className="flex flex-wrap gap-2">
        {PROJECT_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-ink-900 transition ${c === color ? 'ring-ink-900 dark:ring-ink-50' : 'ring-transparent'}`}
            style={{ backgroundColor: c }}
            aria-label={`Pick color ${c}`}
          />
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={save} disabled={!name.trim()}>Save</Button>
      </div>
    </div>
  )
}
