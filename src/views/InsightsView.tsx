import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import { db } from '../db'
import { fmtDuration } from '../lib/format'
import {
  completionRate,
  projectTotals,
  streakDays,
  todayBounds,
  totalsInWindow,
  weekRange,
} from '../lib/stats'
import { useSettings } from '../hooks/useSettings'
import { GoalRing } from '../components/GoalRing'
import { ProjectBars } from '../components/ProjectBars'
import { DailyTimeline } from '../components/DailyTimeline'
import { WeeklyStacks } from '../components/WeeklyStacks'

type RangeMode = 'day' | 'week'

export function InsightsView() {
  const settings = useSettings()
  const pomodoros = useLiveQuery(() => db.pomodoros.orderBy('startedAt').toArray(), [], [])
  const projects = useLiveQuery(() => db.projects.toArray(), [], [])
  const poms = pomodoros ?? []
  const projs = projects ?? []

  const now = new Date()
  const today = todayBounds(now)
  const { start: weekStart, end: weekEnd } = weekRange(now)

  const todayStats = useMemo(() => totalsInWindow(poms, today.start, today.end), [poms, today.start, today.end])
  const weekStats = useMemo(() => totalsInWindow(poms, weekStart.getTime(), weekEnd.getTime()), [poms, weekStart, weekEnd])
  const allTime = useMemo(() => ({ seconds: poms.reduce((a, p) => a + p.actualSeconds, 0), count: poms.length }), [poms])

  const weekDaysList = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])
  const last30 = useMemo(() => projectTotals(poms, projs, subDays(now, 30).getTime()), [poms, projs, now])
  const streak = useMemo(() => streakDays(poms, now), [poms, now])
  const rate = useMemo(() => completionRate(poms), [poms])

  const todayPoms = useMemo(() => poms.filter(p => p.startedAt >= today.start && p.startedAt <= today.end), [poms, today.start, today.end])
  const weekPoms = useMemo(() => poms.filter(p => p.startedAt >= weekStart.getTime() && p.startedAt <= weekEnd.getTime()), [poms, weekStart, weekEnd])

  const [mode, setMode] = useState<RangeMode>('day')
  const goal = settings.dailyGoalPomodoros

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Insights</h1>
        <p className="text-sm text-ink-500 mt-1">Where your focus is going.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Today" sessions={todayStats.count} seconds={todayStats.seconds} accent />
        <StatCard label="This Week" sessions={weekStats.count} seconds={weekStats.seconds} />
        <StatCard label="All Time" sessions={allTime.count} seconds={allTime.seconds} />
      </section>

      <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 flex items-center gap-5">
        <GoalRing current={todayStats.count} goal={goal} size={72} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-ink-500">Daily goal</div>
          <div className="font-display text-2xl text-ink-900 dark:text-ink-50 mt-0.5">
            {todayStats.count} of {goal} Pomodoros
          </div>
          <div className="text-sm text-ink-500 mt-0.5">
            {todayStats.count >= goal
              ? `Hit it. ${fmtDuration(todayStats.seconds)} focused today.`
              : `${goal - todayStats.count} more to go.`}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">
            {mode === 'day' ? 'Today' : 'This week'}
          </h2>
          <div className="inline-flex items-center rounded-full bg-ink-100 dark:bg-ink-800 p-1">
            <ToggleBtn active={mode === 'day'} onClick={() => setMode('day')}>Day</ToggleBtn>
            <ToggleBtn active={mode === 'week'} onClick={() => setMode('week')}>Week</ToggleBtn>
          </div>
        </div>

        {mode === 'day' ? (
          <div className="space-y-3">
            <div className="text-xs text-ink-500">
              {format(now, 'EEEE, MMMM d')} · {todayPoms.length} session{todayPoms.length === 1 ? '' : 's'} · {fmtDuration(todayStats.seconds)}
            </div>
            <DailyTimeline pomodoros={todayPoms} projects={projs} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-ink-500">
              Mon {format(weekStart, 'MMM d')} – Sun {format(weekEnd, 'MMM d')} · each block is a Pomodoro, colored by project.
            </div>
            <WeeklyStacks pomodoros={weekPoms} projects={projs} weekDays={weekDaysList} />
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">By project</h2>
          <span className="text-xs text-ink-500">Last 30 days</span>
        </div>
        <ProjectBars totals={last30} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500">Current streak</div>
          <div className="font-display text-3xl text-ink-900 dark:text-ink-50 mt-1 tabular">
            {streak} day{streak === 1 ? '' : 's'}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {streak === 0 ? 'Start one today.' : streak === 1 ? 'Keep going.' : 'Don’t break the chain.'}
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500">Completion rate</div>
          <div className="font-display text-3xl text-ink-900 dark:text-ink-50 mt-1 tabular">
            {Math.round(rate.rate * 100)}%
          </div>
          <div className="text-xs text-ink-500 mt-1">{rate.completed} of {rate.total} finished</div>
        </div>
      </section>
    </div>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-7 px-3 rounded-full text-xs font-medium transition ${
        active
          ? 'bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-50 shadow-sm'
          : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
      }`}
    >
      {children}
    </button>
  )
}

function StatCard({ label, sessions, seconds, accent }: { label: string; sessions: number; seconds: number; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-1 ${accent
      ? 'bg-ember-500/10 border-ember-500/30 dark:bg-ember-500/15'
      : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
      <div className={`text-xs uppercase tracking-wider ${accent ? 'text-ember-600 dark:text-ember-400' : 'text-ink-500'}`}>
        {label}
      </div>
      <div className="font-display text-2xl text-ink-900 dark:text-ink-50 tabular">
        {fmtDuration(seconds) || '0m'}
      </div>
      <div className="text-xs text-ink-500">{sessions} session{sessions === 1 ? '' : 's'}</div>
    </div>
  )
}
