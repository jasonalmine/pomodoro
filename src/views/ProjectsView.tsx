import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react'
import { subDays } from 'date-fns'
import { db, PROJECT_COLORS } from '../db'
import { Button } from '../components/Button'
import { fmtDuration } from '../lib/format'
import { pomodorosByTask } from '../lib/stats'
import type { Pomodoro, Project, Task } from '../types'

type Totals = { allTime: number; last30: number; count: number }

function buildTotals(pomodoros: Pomodoro[]): Map<string, Totals> {
  const cutoff = subDays(new Date(), 30).getTime()
  const m = new Map<string, Totals>()
  for (const p of pomodoros) {
    const t = m.get(p.projectId) ?? { allTime: 0, last30: 0, count: 0 }
    t.allTime += p.actualSeconds
    if (p.startedAt >= cutoff) t.last30 += p.actualSeconds
    t.count += 1
    m.set(p.projectId, t)
  }
  return m
}

export function ProjectsView() {
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [], [])
  const pomodoros = useLiveQuery(() => db.pomodoros.toArray(), [], [])
  const tasks = useLiveQuery(() => db.tasks.orderBy('createdAt').toArray(), [], [])
  const totals = useMemo(() => buildTotals(pomodoros ?? []), [pomodoros])
  const taskCounts = useMemo(() => pomodorosByTask(pomodoros ?? []), [pomodoros])
  const tasksByProject = useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks ?? []) {
      if (t.archivedAt) continue
      const arr = m.get(t.projectId) ?? []
      arr.push(t)
      m.set(t.projectId, arr)
    }
    return m
  }, [tasks])
  const [editing, setEditing] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
        {(projects ?? []).map(p => {
          const t = totals.get(p.id) ?? { allTime: 0, last30: 0, count: 0 }
          const projectTasks = tasksByProject.get(p.id) ?? []
          const openCount = projectTasks.filter(x => !x.completed).length
          const isExpanded = expanded.has(p.id)
          return (
            <div
              key={p.id}
              className={`rounded-2xl border ${p.archived ? 'opacity-60 border-ink-200 dark:border-ink-800' : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}
            >
              <div className="p-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev)
                    if (next.has(p.id)) next.delete(p.id); else next.add(p.id)
                    return next
                  })}
                  className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-100 transition shrink-0"
                  aria-label={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-900 dark:text-ink-100 truncate">{p.name}</div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] tabular text-ink-500">
                    <span>{t.count} session{t.count === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span>{fmtDuration(t.last30)} <span className="text-ink-400">last 30d</span></span>
                    <span className="text-ink-400">·</span>
                    <span>{fmtDuration(t.allTime)} <span className="text-ink-400">all time</span></span>
                    {openCount > 0 && (
                      <>
                        <span className="text-ink-400">·</span>
                        <span className="inline-flex items-center gap-1"><ListTodo size={11} />{openCount} open</span>
                      </>
                    )}
                  </div>
                  {p.description && <div className="text-xs text-ink-500 truncate mt-1">{p.description}</div>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label="Edit project">
                  <Pencil size={16} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => db.projects.update(p.id, { archived: !p.archived, updatedAt: Date.now() })}>
                  {p.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={async () => {
                  if (!confirm(`Delete project "${p.name}"? Past Pomodoros are kept.`)) return
                  await db.projects.delete(p.id)
                }}>
                  <Trash2 size={16} className="text-rose-500" />
                </Button>
              </div>
              {isExpanded && (
                <TaskList projectId={p.id} tasks={projectTasks} counts={taskCounts} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskList({ projectId, tasks, counts }: { projectId: string; tasks: Task[]; counts: Map<string, number> }) {
  const [draft, setDraft] = useState('')
  const [draftEst, setDraftEst] = useState(1)
  const open = tasks.filter(t => !t.completed)
  const done = tasks.filter(t => t.completed)

  const addTask = async () => {
    const name = draft.trim()
    if (!name) return
    const now = Date.now()
    await db.tasks.put({
      id: crypto.randomUUID(),
      projectId,
      name,
      estPomodoros: Math.max(1, Math.min(20, draftEst)),
      completed: false,
      order: now,
      createdAt: now,
      updatedAt: now,
    })
    setDraft('')
    setDraftEst(1)
  }

  return (
    <div className="border-t border-ink-100 dark:border-ink-800 px-4 py-3 space-y-2">
      {open.length === 0 && done.length === 0 && (
        <p className="text-xs text-ink-500">No tasks yet. Plan a few below.</p>
      )}
      {open.length > 0 && (
        <ul className="space-y-1">
          {open.map(t => <TaskRow key={t.id} task={t} count={counts.get(t.id) ?? 0} />)}
        </ul>
      )}
      {done.length > 0 && (
        <details className="text-xs text-ink-500">
          <summary className="cursor-pointer select-none hover:text-ink-700 dark:hover:text-ink-200 transition py-1">
            {done.length} done
          </summary>
          <ul className="space-y-1 mt-1">
            {done.map(t => <TaskRow key={t.id} task={t} count={counts.get(t.id) ?? 0} />)}
          </ul>
        </details>
      )}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addTask() } }}
          placeholder="Add a task…"
          className="flex-1 rounded-lg border border-ink-200 dark:border-ink-800 bg-transparent px-2.5 h-9 text-sm text-ink-900 dark:text-ink-100 focus:border-accent focus:ring-0 outline-none"
        />
        <div className="inline-flex items-center gap-1 rounded-lg border border-ink-200 dark:border-ink-800 px-1.5 h-9">
          <button
            type="button"
            onClick={() => setDraftEst(v => Math.max(1, v - 1))}
            className="h-7 w-7 rounded-md text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
            aria-label="Decrease estimate"
          >−</button>
          <span className="text-xs tabular w-6 text-center">{draftEst}🍅</span>
          <button
            type="button"
            onClick={() => setDraftEst(v => Math.min(20, v + 1))}
            className="h-7 w-7 rounded-md text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition"
            aria-label="Increase estimate"
          >+</button>
        </div>
        <Button size="sm" onClick={addTask} disabled={!draft.trim()}>Add</Button>
      </div>
    </div>
  )
}

function TaskRow({ task, count }: { task: Task; count: number }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(task.name)
  const [est, setEst] = useState(task.estPomodoros)

  const toggleComplete = async () => {
    const now = Date.now()
    await db.tasks.update(task.id, {
      completed: !task.completed,
      completedAt: !task.completed ? now : undefined,
      updatedAt: now,
    })
  }

  const save = async () => {
    const n = name.trim()
    if (!n) { setEditing(false); setName(task.name); return }
    await db.tasks.update(task.id, {
      name: n,
      estPomodoros: Math.max(1, Math.min(20, est)),
      updatedAt: Date.now(),
    })
    setEditing(false)
  }

  const remove = async () => {
    if (!confirm(`Delete task "${task.name}"?`)) return
    await db.tasks.delete(task.id)
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-1">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void save() }
            else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setName(task.name) }
          }}
          autoFocus
          className="flex-1 rounded-md border border-accent bg-transparent px-2 h-8 text-sm focus:ring-0 outline-none"
        />
        <input
          type="number" min={1} max={20} value={est}
          onChange={e => setEst(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          className="w-14 rounded-md border border-ink-200 dark:border-ink-800 bg-transparent px-2 h-8 text-xs tabular text-center"
        />
        <button type="button" onClick={save} className="text-xs text-accent hover:underline">Save</button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-2 py-1 group">
      <button
        type="button"
        onClick={toggleComplete}
        className={`h-4 w-4 rounded-sm border-2 transition shrink-0 ${task.completed ? 'bg-accent border-accent' : 'border-ink-300 dark:border-ink-700 hover:border-accent'}`}
        aria-label={task.completed ? 'Mark task as not done' : 'Mark task as done'}
      >
        {task.completed && (
          <svg viewBox="0 0 12 12" className="w-full h-full text-white" fill="none">
            <path d="M3 6.5l2 2 4-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onDoubleClick={() => setEditing(true)}
        className={`flex-1 text-left text-sm truncate transition ${task.completed ? 'line-through text-ink-400' : 'text-ink-800 dark:text-ink-100 hover:text-accent'}`}
        title="Double-click to edit"
      >
        {task.name}
      </button>
      <span className="text-[11px] tabular text-ink-500 shrink-0">
        {count}/{task.estPomodoros}🍅
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition"
        aria-label="Edit task"
      >
        <Pencil size={12} />
      </button>
      <button
        type="button"
        onClick={remove}
        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-rose-500 transition"
        aria-label="Delete task"
      >
        <Trash2 size={12} />
      </button>
    </li>
  )
}

function ProjectForm({ initial, onSave, onCancel }: { initial: Project | null; onSave: (p: Project) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? PROJECT_COLORS[0])
  const [description, setDescription] = useState(initial?.description ?? '')

  const save = () => {
    if (!name.trim()) return
    const now = Date.now()
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      color,
      description: description.trim() || undefined,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
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
