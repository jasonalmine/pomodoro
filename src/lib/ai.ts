import { format } from 'date-fns'
import type { AnthropicModel, DayShutdown, Pomodoro, Project, Task } from '../types'
import { fmtDuration } from './format'

const MODEL_IDS: Record<AnthropicModel, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-7',
}

export const MODEL_LABELS: Record<AnthropicModel, { label: string; hint: string }> = {
  haiku: { label: 'Haiku 4.5', hint: 'Fastest, cheapest. Great for routine summaries.' },
  sonnet: { label: 'Sonnet 4.6', hint: 'Balanced. Better pattern-spotting.' },
  opus: { label: 'Opus 4.7', hint: 'Strongest reasoning. Slower and pricier.' },
}

export type WeeklyContext = {
  weekStart: Date
  weekEnd: Date
  pomodoros: Pomodoro[]
  projects: Project[]
  tasks: Task[]
  shutdowns: DayShutdown[]
}

const SYSTEM_PROMPT = `You are a thoughtful, calm coach reviewing one focused worker's last week of Pomodoro sessions. The user is using a reflection-first focus app and values short, specific, honest observations over hype.

Your job is to write a brief weekly review that helps them notice patterns they would otherwise miss. Be concrete. Use their own words from their reflection notes when relevant.

Output format (markdown):

## Where the week went
One short paragraph naming the top projects and what they covered, with totals.

## Patterns
2–4 bullets, each one specific. Examples: "Mornings were heavier than afternoons.", "Fridays dropped off after lunch.", "When you set a 25-minute target, you almost always extended."

## What you said worked
1–3 bullets pulled (lightly paraphrased) from their reflection notes and day-shutdown wins. Quote their language where it's vivid.

## Something to try next week
ONE small, concrete experiment grounded in the data. Not generic productivity advice.

Keep the whole review under ~200 words. No greetings, no sign-off, no emojis.`

function isoWeekKey(d: Date): string {
  // ISO 8601 week — uses Thursday-of-week to compute the year correctly.
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export function currentWeekKey(d = new Date()): string {
  return isoWeekKey(d)
}

export function buildWeeklyPrompt(ctx: WeeklyContext): string {
  const { weekStart, weekEnd, pomodoros, projects, tasks, shutdowns } = ctx
  const projById = new Map(projects.map(p => [p.id, p]))
  const taskById = new Map(tasks.map(t => [t.id, t]))

  // Totals by project
  const totalsByProj = new Map<string, { seconds: number; count: number }>()
  for (const p of pomodoros) {
    const e = totalsByProj.get(p.projectId) ?? { seconds: 0, count: 0 }
    e.seconds += p.actualSeconds
    e.count += 1
    totalsByProj.set(p.projectId, e)
  }
  const totalsLines = [...totalsByProj.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .map(([id, t]) => {
      const proj = projById.get(id)
      return `- ${proj?.name ?? '(deleted)'}: ${fmtDuration(t.seconds)} across ${t.count} session${t.count === 1 ? '' : 's'}`
    })
    .join('\n') || '- (no sessions this week)'

  // Per-day breakdown
  const byDay = new Map<string, { seconds: number; count: number }>()
  for (const p of pomodoros) {
    const k = format(new Date(p.startedAt), 'EEE MMM d')
    const e = byDay.get(k) ?? { seconds: 0, count: 0 }
    e.seconds += p.actualSeconds
    e.count += 1
    byDay.set(k, e)
  }
  const dayLines = [...byDay.entries()]
    .map(([k, v]) => `- ${k}: ${v.count}× (${fmtDuration(v.seconds)})`)
    .join('\n') || '- (none)'

  // Reflection notes
  const reflections: string[] = []
  for (const p of pomodoros) {
    const parts: string[] = []
    if (p.noteDone) parts.push(`done: ${p.noteDone}`)
    if (p.noteNext) parts.push(`next: ${p.noteNext}`)
    if (p.note) parts.push(`note: ${p.note}`)
    if (parts.length) {
      const proj = projById.get(p.projectId)?.name ?? '?'
      const task = p.taskId ? taskById.get(p.taskId)?.name ?? p.task : p.task
      reflections.push(`- ${format(new Date(p.startedAt), 'EEE')} · ${proj} · ${task}: ${parts.join(' | ')}`)
    }
  }
  const reflectionBlock = reflections.length ? reflections.join('\n') : '- (no reflections logged)'

  // Shutdowns
  const shutdownLines = shutdowns
    .filter(d => d.date >= weekStart.getTime() && d.date <= weekEnd.getTime())
    .map(d => {
      const parts: string[] = []
      if (d.wins) parts.push(`wins: ${d.wins}`)
      if (d.blockers) parts.push(`blockers: ${d.blockers}`)
      if (d.tomorrowTask) parts.push(`tomorrow: ${d.tomorrowTask}`)
      return `- ${format(new Date(d.date), 'EEE MMM d')}: ${parts.join(' | ')}`
    })
    .join('\n') || '- (no day-shutdowns logged)'

  return `# Week of ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}

## Totals by project
${totalsLines}

## Sessions by day
${dayLines}

## Per-session reflection notes
${reflectionBlock}

## Day-shutdown notes
${shutdownLines}

Write the weekly review now, following the format in the system instructions.`
}

export type AIError = { status: number; message: string }

export async function callAnthropic(opts: {
  apiKey: string
  model: AnthropicModel
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL_IDS[opts.model],
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
    }),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message ?? JSON.stringify(j)
    } catch { detail = await res.text().catch(() => '') }
    const err: AIError = { status: res.status, message: detail || `HTTP ${res.status}` }
    throw err
  }

  const json = await res.json() as { content?: Array<{ type: string; text?: string }> }
  const text = (json.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('\n')
    .trim()
  if (!text) throw { status: 0, message: 'Empty response from model.' } as AIError
  return text
}

export async function generateWeeklyReview(ctx: WeeklyContext, apiKey: string, model: AnthropicModel): Promise<string> {
  const prompt = buildWeeklyPrompt(ctx)
  return callAnthropic({ apiKey, model, systemPrompt: SYSTEM_PROMPT, userPrompt: prompt, maxTokens: 600 })
}

export function modelIdFor(model: AnthropicModel): string {
  return MODEL_IDS[model]
}
