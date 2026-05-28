import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bookmark, Cloud, CloudOff, Download, FileDown, LogOut, RefreshCw, Sparkles, Trash2, Upload } from 'lucide-react'
import { BREATH_PATTERNS, db } from '../db'
import { useSettings, updateSettings } from '../hooks/useSettings'
import { useSync } from '../hooks/useSync'
import { chime, breathCue } from '../audio/engine'
import { exportCsv, exportJson, importJson } from '../lib/exportImport'
import { signInWithEmail, signOut, syncNow } from '../lib/sync'
import { DEFAULT_MODELS, PROVIDER_META } from '../lib/ai'
import { Button } from '../components/Button'
import type { AiProvider, AmbientId, Palette, ThemeMode } from '../types'

export function SettingsView() {
  const s = useSettings()

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">Tune the rhythm to your work.</p>
      </header>

      <Section title="Daily goal">
        <div className="flex items-center gap-4">
          <Num label="Pomodoros per day" value={s.dailyGoalPomodoros} min={1} max={20}
            onChange={v => updateSettings({ dailyGoalPomodoros: v })} />
          <div className="text-xs text-ink-500 flex-1">
            How many focus sessions you’re aiming for each day. Shown as a ring on the Insights tab.
          </div>
        </div>
      </Section>

      <Section title="Timer defaults">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Num label="Work (min)" value={s.timer.workMinutes} min={1} max={180}
            onChange={v => updateSettings({ timer: { ...s.timer, workMinutes: v } })} />
          <Num label="Short break" value={s.timer.shortBreakMinutes} min={1} max={60}
            onChange={v => updateSettings({ timer: { ...s.timer, shortBreakMinutes: v } })} />
          <Num label="Long break" value={s.timer.longBreakMinutes} min={1} max={120}
            onChange={v => updateSettings({ timer: { ...s.timer, longBreakMinutes: v } })} />
          <Num label="Long every" value={s.timer.longBreakEvery} min={2} max={12}
            onChange={v => updateSettings({ timer: { ...s.timer, longBreakEvery: v } })} />
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Toggle label="Auto-start breaks after work" checked={s.timer.autoStartBreaks}
            onChange={v => updateSettings({ timer: { ...s.timer, autoStartBreaks: v } })} />
          <Toggle label="Auto-start next focus after break" checked={s.timer.autoStartWork}
            onChange={v => updateSettings({ timer: { ...s.timer, autoStartWork: v } })} />
          <p className="text-[11px] text-ink-500 -mt-1">
            Off (default) gives you a moment to decide before each phase starts.
          </p>
          <Toggle label="Allow overtime" checked={s.timer.allowOvertime}
            onChange={v => updateSettings({ timer: { ...s.timer, allowOvertime: v } })} />
          <p className="text-[11px] text-ink-500 -mt-1">
            On (default): the timer keeps counting after the planned time and the ±5 min buttons are available. Off (strict Pomodoro): sessions auto-advance at the boundary, and you can't extend.
          </p>
        </div>
      </Section>

      <Section title="Pre-session ritual">
        <Toggle label="Breathing warm-up before focus" checked={s.ritual.enabled}
          onChange={v => updateSettings({ ritual: { ...s.ritual, enabled: v } })} />
        <Field label="Breath pattern">
          <select
            value={s.ritual.patternId}
            onChange={e => updateSettings({ ritual: { ...s.ritual, patternId: e.target.value } })}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
          >
            {BREATH_PATTERNS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Num label="Cycles" value={s.ritual.cycles} min={0} max={20}
            onChange={v => updateSettings({ ritual: { ...s.ritual, cycles: v } })} />
        </div>
        <Toggle label="Soft breath cue tones" checked={s.ritual.breathCues}
          onChange={v => updateSettings({ ritual: { ...s.ritual, breathCues: v } })}
          onPreview={() => breathCue('in', s.audio.breathCueVolume)}
        />
      </Section>

      <Section title="Audio">
        <Toggle label="Muted" checked={s.audio.muted}
          onChange={v => updateSettings({ audio: { ...s.audio, muted: v } })} />
        <Slider label="Master" value={s.audio.master}
          onChange={v => updateSettings({ audio: { ...s.audio, master: v } })} />
        <Slider label="Chime" value={s.audio.chimeVolume} preview={() => chime('start', s.audio.chimeVolume)}
          onChange={v => updateSettings({ audio: { ...s.audio, chimeVolume: v } })} />
        <Slider label="Breath cue" value={s.audio.breathCueVolume} preview={() => breathCue('in', s.audio.breathCueVolume)}
          onChange={v => updateSettings({ audio: { ...s.audio, breathCueVolume: v } })} />
        <Field label="Ambient during focus">
          <select
            value={s.audio.ambient}
            onChange={e => updateSettings({ audio: { ...s.audio, ambient: e.target.value as AmbientId } })}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
          >
            <option value="none">None</option>
            <option value="rain">Rain</option>
            <option value="brown">Brown noise</option>
            <option value="lofi">Lo-fi pad</option>
            <option value="ticking">Ticking clock</option>
          </select>
        </Field>
        <Slider label="Ambient volume" value={s.audio.ambientVolume}
          onChange={v => updateSettings({ audio: { ...s.audio, ambientVolume: v } })} />
      </Section>

      <Section title="System">
        <Toggle label="Browser notifications when tab is hidden" checked={s.notifications}
          onChange={v => updateSettings({ notifications: v })} />
        <Toggle label="Keep screen awake during sessions" checked={s.wakeLock}
          onChange={v => updateSettings({ wakeLock: v })} />
        <Field label="Theme">
          <div className="flex gap-2">
            {(['system','light','dark'] as ThemeMode[]).map(t => (
              <button key={t} onClick={() => updateSettings({ theme: t })}
                className={`flex-1 h-10 rounded-xl border text-sm capitalize transition
                  ${s.theme === t ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900 border-transparent' : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-200'}`}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Palette">
          <div className="flex gap-2">
            {([
              { id: 'ember', label: 'Ember', swatch: '#ff6a37' },
              { id: 'pine', label: 'Pine', swatch: '#168463' },
              { id: 'slate', label: 'Slate', swatch: '#646473' },
            ] as Array<{ id: Palette; label: string; swatch: string }>).map(p => (
              <button key={p.id} onClick={() => updateSettings({ palette: p.id })}
                className={`flex-1 h-10 rounded-xl border text-sm transition flex items-center justify-center gap-2
                  ${(s.palette ?? 'ember') === p.id ? 'bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900 border-transparent' : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-200'}`}>
                <span className="h-3 w-3 rounded-full" style={{ background: p.swatch }} />
                {p.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <TemplatesSection />

      <AIReviewSection />

      <CloudSyncSection />

      <DataSection />
    </div>
  )
}

function NewTemplateButton() {
  const s = useSettings()
  const onClick = async () => {
    const name = window.prompt('Template name (e.g. "Deep Work"):')?.trim()
    if (!name) return
    const now = Date.now()
    await db.templates.put({
      id: crypto.randomUUID(),
      name,
      workMinutes: s.timer.workMinutes,
      shortBreakMinutes: s.timer.shortBreakMinutes,
      longBreakMinutes: s.timer.longBreakMinutes,
      useRitual: s.ritual.enabled,
      createdAt: now,
      updatedAt: now,
    })
  }
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <Bookmark size={14} /> New template
    </Button>
  )
}

function TemplatesSection() {
  const templates = useLiveQuery(() => db.templates.orderBy('createdAt').toArray(), [], [])

  if (!templates || templates.length === 0) {
    return (
      <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-3">
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Templates</h2>
        <p className="text-xs text-ink-500">
          Save preset focus combos (project + durations + ritual) for one-tap launch from the Timer screen.
        </p>
        <NewTemplateButton />
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Templates</h2>
        <NewTemplateButton />
      </div>
      <div className="space-y-2">
        {templates.map(t => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-ink-200 dark:border-ink-800 p-3">
            <Bookmark size={16} className="text-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{t.name}</div>
              <div className="text-[11px] text-ink-500 tabular">
                {t.workMinutes}m focus · {t.shortBreakMinutes}m short · {t.longBreakMinutes}m long
                {t.useRitual ? ' · with ritual' : ''}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={async () => {
              if (!confirm(`Delete template "${t.name}"?`)) return
              await db.templates.delete(t.id)
            }}>
              <Trash2 size={14} className="text-rose-500" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

function AIReviewSection() {
  const s = useSettings()
  const provider: AiProvider = s.aiProvider ?? 'gemini'
  const apiKey = s.aiApiKey ?? ''
  const legacyKey = s.anthropicApiKey
  const model = s.aiModel ?? ''
  const [show, setShow] = useState(false)
  const meta = PROVIDER_META[provider]

  const migrateLegacy = () => {
    if (!legacyKey) return
    updateSettings({ aiProvider: 'anthropic', aiApiKey: legacyKey, anthropicApiKey: undefined })
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-accent" />
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">AI weekly review</h2>
      </div>
      <p className="text-xs text-ink-500">
        A short coach-style summary of your week. Bring your own key from any supported provider. It stays on this device and is never synced or exported.
      </p>

      {legacyKey && !s.aiApiKey && (
        <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>Found an old Anthropic key. Keep using it?</span>
          <button type="button" onClick={migrateLegacy} className="underline font-medium shrink-0">Migrate</button>
        </div>
      )}

      <Field label="Provider">
        <div className="grid grid-cols-3 gap-2">
          {(['gemini', 'openai', 'anthropic'] as AiProvider[]).map(p => {
            const selected = provider === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => updateSettings({ aiProvider: p, aiModel: '' })}
                className={
                  'rounded-xl border px-2 py-2.5 text-center transition ' +
                  (selected
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-ink-200 dark:border-ink-800 text-ink-700 dark:text-ink-200 hover:border-ink-300 dark:hover:border-ink-700')
                }
              >
                <div className="text-xs font-medium">{PROVIDER_META[p].label}</div>
              </button>
            )
          })}
        </div>
      </Field>

      <p className="text-[11px] text-ink-500 -mt-1">
        {meta.hint} Get a key at{' '}
        <a href={meta.keyUrl} target="_blank" rel="noreferrer" className="underline">{new URL(meta.keyUrl).host}</a>.
      </p>

      <Field label="API key">
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={apiKey}
            onChange={e => updateSettings({ aiApiKey: e.target.value.trim() || undefined })}
            placeholder={provider === 'anthropic' ? 'sk-ant-…' : provider === 'openai' ? 'sk-…' : 'AIza…'}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm font-mono dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100 pr-16"
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-500 hover:text-ink-800 dark:hover:text-ink-100 px-2 py-1 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
      </Field>

      <Field label="Model">
        <input
          value={model}
          onChange={e => updateSettings({ aiModel: e.target.value })}
          placeholder={`Default: ${DEFAULT_MODELS[provider]}`}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm font-mono dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
        />
      </Field>
      <p className="text-[11px] text-ink-400 -mt-1">
        Leave blank to use <span className="font-mono">{DEFAULT_MODELS[provider]}</span>. Override if you want a different model.
      </p>

      {!apiKey && (
        <p className="text-[11px] text-ink-400">Without a key, the "Generate" button on Insights → Week is disabled.</p>
      )}
    </section>
  )
}

function CloudSyncSection() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!sync.enabled) {
    return (
      <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CloudOff size={18} className="text-ink-400" />
          <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Cloud sync</h2>
        </div>
        <p className="text-xs text-ink-500">
          Not configured. Set <code className="font-mono">VITE_SUPABASE_URL</code> and <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> environment variables to enable cross-device sync. See <code className="font-mono">docs/SUPABASE_SETUP.md</code>.
        </p>
      </section>
    )
  }

  const onSendLink = async () => {
    if (!email.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      await signInWithEmail(email.trim())
      setStatus({ kind: 'ok', text: `Magic link sent to ${email.trim()}. Check your inbox.` })
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Failed to send link.' })
    } finally {
      setBusy(false)
    }
  }

  const onSyncNow = async () => {
    setBusy(true)
    setStatus(null)
    try {
      await syncNow()
      setStatus({ kind: 'ok', text: 'Synced.' })
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Sync failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Cloud size={18} className="text-accent" />
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Cloud sync</h2>
      </div>
      {sync.user ? (
        <>
          <p className="text-xs text-ink-500">
            Signed in as <span className="text-ink-700 dark:text-ink-200 font-medium">{sync.user.email}</span>. Projects, sessions, tasks, and templates sync across every device you sign in on.
          </p>
          <p className="text-[11px] text-ink-400 tabular">
            {sync.lastSyncedAt > 0
              ? <>Last synced {fmtRelative(sync.lastSyncedAt)}</>
              : <>Not synced yet on this device.</>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onSyncNow} disabled={busy || sync.syncing}>
              <RefreshCw size={16} className={sync.syncing ? 'animate-spin' : ''} /> {sync.syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button variant="ghost" onClick={() => void signOut()} disabled={busy}>
              <LogOut size={16} /> Sign out
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            Cloud sync is configured but you're <span className="font-medium">not signed in</span>. Your data lives only in this browser. Sign in below to start backing it up.
          </div>
          <p className="text-xs text-ink-500">
            Sign in to back up your data and access it on every device. We'll email you a magic link, no password.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100"
            />
            <Button onClick={onSendLink} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send magic link'}
            </Button>
          </div>
        </>
      )}
      {(status || sync.lastError) && (
        <div className={`text-xs ${status?.kind === 'err' || sync.lastError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {status?.text || sync.lastError}
        </div>
      )}
    </section>
  )
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [importing, setImporting] = useState(false)

  const onImport = async (file: File) => {
    if (!confirm('Importing will REPLACE all current projects, sessions, and settings. Continue?')) return
    setImporting(true)
    setStatus(null)
    try {
      const r = await importJson(file)
      setStatus({ kind: 'ok', text: `Restored ${r.projects} project${r.projects === 1 ? '' : 's'}, ${r.pomodoros} session${r.pomodoros === 1 ? '' : 's'}, ${r.tasks} task${r.tasks === 1 ? '' : 's'}, ${r.dayShutdowns} shutdown${r.dayShutdowns === 1 ? '' : 's'}, ${r.dayNotes} note${r.dayNotes === 1 ? '' : 's'}${r.settingsRestored ? ', plus settings' : ''}.` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed.'
      setStatus({ kind: 'err', text: msg })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Your data</h2>
        <p className="text-xs text-ink-500 mt-1">
          Everything lives in this browser. Export to keep a backup or analyze elsewhere. Import replaces everything.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void exportCsv()}>
          <FileDown size={16} /> Export CSV
        </Button>
        <Button variant="secondary" onClick={() => void exportJson()}>
          <Download size={16} /> Export JSON
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
          <Upload size={16} /> {importing ? 'Importing…' : 'Import JSON'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) void onImport(f)
          }}
        />
      </div>
      {status && (
        <div className={`text-xs ${status.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {status.text}
        </div>
      )}
    </section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</span>
      {children}
    </label>
  )
}

function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</span>
      <input type="number" inputMode="numeric" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full rounded-xl border border-ink-200 bg-white px-3 h-11 text-sm tabular dark:bg-ink-900 dark:border-ink-700 dark:text-ink-100" />
    </label>
  )
}

function Toggle({ label, checked, onChange, onPreview }: { label: string; checked: boolean; onChange: (v: boolean) => void; onPreview?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <button onClick={onPreview} className="flex-1 text-left text-sm text-ink-700 dark:text-ink-200">{label}</button>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-accent' : 'bg-ink-200 dark:bg-ink-700'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function fmtRelative(ts: number): string {
  const diffMs = Date.now() - ts
  if (diffMs < 0) return 'just now'
  const sec = Math.round(diffMs / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

function Slider({ label, value, onChange, preview }: { label: string; value: number; onChange: (v: number) => void; preview?: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</span>
        <span className="text-xs tabular text-ink-500">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseUp={preview} onTouchEnd={preview}
        className="w-full accent-accent"
      />
    </div>
  )
}
