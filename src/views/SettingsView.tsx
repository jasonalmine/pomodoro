import { useRef, useState } from 'react'
import { Download, FileDown, Upload } from 'lucide-react'
import { BREATH_PATTERNS } from '../db'
import { useSettings, updateSettings } from '../hooks/useSettings'
import { chime, breathCue } from '../audio/engine'
import { exportCsv, exportJson, importJson } from '../lib/exportImport'
import { Button } from '../components/Button'
import type { AmbientId, ThemeMode } from '../types'

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
          <Toggle label="Auto-start breaks" checked={s.timer.autoStartBreaks}
            onChange={v => updateSettings({ timer: { ...s.timer, autoStartBreaks: v } })} />
          <Toggle label="Auto-start next focus after break" checked={s.timer.autoStartWork}
            onChange={v => updateSettings({ timer: { ...s.timer, autoStartWork: v } })} />
        </div>
      </Section>

      <Section title="Pre-session ritual">
        <Toggle label="Enable breathing + meditation" checked={s.ritual.enabled}
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
          <Num label="Meditation (sec)" value={s.ritual.meditationSeconds} min={0} max={1800}
            onChange={v => updateSettings({ ritual: { ...s.ritual, meditationSeconds: v } })} />
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
      </Section>

      <DataSection />
    </div>
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
      setStatus({ kind: 'ok', text: `Restored ${r.projects} project${r.projects === 1 ? '' : 's'}, ${r.pomodoros} session${r.pomodoros === 1 ? '' : 's'}${r.settingsRestored ? ', plus settings' : ''}.` })
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
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-ember-500' : 'bg-ink-200 dark:bg-ink-700'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
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
        className="w-full accent-ember-500"
      />
    </div>
  )
}
