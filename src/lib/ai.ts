import { format } from 'date-fns'
import type { AiProvider, DayShutdown, Pomodoro, Project, Task } from '../types'
import { fmtDuration } from './format'

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
}

export const PROVIDER_META: Record<AiProvider, { label: string; keyUrl: string; hint: string }> = {
  anthropic: {
    label: 'Anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    hint: 'Prepaid credits. A review costs well under $0.01.',
  },
  openai: {
    label: 'OpenAI',
    keyUrl: 'https://platform.openai.com/api-keys',
    hint: 'Prepaid credits. gpt-4o-mini is very cheap.',
  },
  gemini: {
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    hint: 'Has a genuinely free tier (rate-limited). Cheapest option.',
  },
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
2-4 bullets, each one specific. Examples: "Mornings were heavier than afternoons.", "Fridays dropped off after lunch.", "When you set a 25-minute target, you almost always extended."

## What you said worked
1-3 bullets pulled (lightly paraphrased) from their reflection notes and day-shutdown wins. Quote their language where it's vivid.

## Something to try next week
ONE small, concrete experiment grounded in the data. Not generic productivity advice.

Keep the whole review under ~200 words. No greetings, no sign-off, no emojis.`

function isoWeekKey(d: Date): string {
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

  const byDay = new Map<string, { seconds: number; count: number }>()
  for (const p of pomodoros) {
    const k = format(new Date(p.startedAt), 'EEE MMM d')
    const e = byDay.get(k) ?? { seconds: 0, count: 0 }
    e.seconds += p.actualSeconds
    e.count += 1
    byDay.set(k, e)
  }
  const dayLines = [...byDay.entries()]
    .map(([k, v]) => `- ${k}: ${v.count}x (${fmtDuration(v.seconds)})`)
    .join('\n') || '- (none)'

  const reflections: string[] = []
  for (const p of pomodoros) {
    const parts: string[] = []
    if (p.noteDone) parts.push(`done: ${p.noteDone}`)
    if (p.noteNext) parts.push(`next: ${p.noteNext}`)
    if (p.note) parts.push(`note: ${p.note}`)
    if (p.tags?.length) parts.push(`tags: ${p.tags.join(', ')}`)
    if (parts.length) {
      const proj = projById.get(p.projectId)?.name ?? '?'
      const task = p.taskId ? taskById.get(p.taskId)?.name ?? p.task : p.task
      reflections.push(`- ${format(new Date(p.startedAt), 'EEE')} · ${proj} · ${task}: ${parts.join(' | ')}`)
    }
  }
  const reflectionBlock = reflections.length ? reflections.join('\n') : '- (no reflections logged)'

  // Aggregate tag totals so the model can spot tag-level patterns even from
  // sessions that didn't otherwise leave a reflection note.
  const tagCounts = new Map<string, number>()
  for (const p of pomodoros) {
    if (!p.tags) continue
    for (const raw of p.tags) {
      const t = raw.trim().toLowerCase()
      if (!t) continue
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
    }
  }
  const tagLines = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `- ${t}: ${n} session${n === 1 ? '' : 's'}`)
    .join('\n') || '- (no tags)'

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

  return `# Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}

## Totals by project
${totalsLines}

## Sessions by day
${dayLines}

## Per-session reflection notes
${reflectionBlock}

## Tag totals
${tagLines}

## Day-shutdown notes
${shutdownLines}

Write the weekly review now, following the format in the system instructions.`
}

export type AIError = { status: number; message: string }

function aiErr(status: number, message: string): AIError {
  return { status, message }
}

async function callAnthropic(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error?.message ?? JSON.stringify(j) } catch { detail = await res.text().catch(() => '') }
    throw aiErr(res.status, detail || `HTTP ${res.status}`)
  }
  const json = await res.json() as { content?: Array<{ type: string; text?: string }> }
  const text = (json.content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n').trim()
  if (!text) throw aiErr(0, 'Empty response from model.')
  return text
}

async function callOpenAI(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error?.message ?? JSON.stringify(j) } catch { detail = await res.text().catch(() => '') }
    throw aiErr(res.status, detail || `HTTP ${res.status}`)
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  const text = (json.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw aiErr(0, 'Empty response from model.')
  return text
}

async function callGemini(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error?.message ?? JSON.stringify(j) } catch { detail = await res.text().catch(() => '') }
    throw aiErr(res.status, detail || `HTTP ${res.status}`)
  }
  const json = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = (json.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
  if (!text) throw aiErr(0, 'Empty response from model (it may have hit a safety filter or token limit).')
  return text
}

export async function generateWeeklyReview(
  ctx: WeeklyContext,
  provider: AiProvider,
  apiKey: string,
  model: string,
): Promise<string> {
  const prompt = buildWeeklyPrompt(ctx)
  const m = model.trim() || DEFAULT_MODELS[provider]
  const maxTokens = 700
  switch (provider) {
    case 'anthropic': return callAnthropic(apiKey, m, SYSTEM_PROMPT, prompt, maxTokens)
    case 'openai': return callOpenAI(apiKey, m, SYSTEM_PROMPT, prompt, maxTokens)
    case 'gemini': return callGemini(apiKey, m, SYSTEM_PROMPT, prompt, maxTokens)
  }
}

export function resolvedModel(provider: AiProvider, model: string | undefined): string {
  return (model && model.trim()) || DEFAULT_MODELS[provider]
}
