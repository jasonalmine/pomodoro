import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { eachDayOfInterval, format, subDays } from 'date-fns'
import { db } from '../db'
import { fmtDuration } from '../lib/format'
import {
  completionRate,
  lifetimeStats,
  projectTotals,
  streakDays,
  todayBounds,
  totalsInWindow,
  weekRange,
  yearlyHeatmap,
} from '../lib/stats'
import { useSettings } from '../hooks/useSettings'
import { GoalRing } from '../components/GoalRing'
import { ProjectBars } from '../components/ProjectBars'
import { DailyTimeline } from '../components/DailyTimeline'
import { WeeklyStacks } from '../components/WeeklyStacks'
import { YearHeatmap } from '../components/YearHeatmap'

type ViewMode = 'today' | 'week' | 'lifetime' | 'year'

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

  const lifetime = useMemo(() => lifetimeStats(poms, projs), [poms, projs])
  const heatmap = useMemo(() => yearlyHeatmap(poms, now), [poms, now])
  const yearStats = useMemo(() => {
    const yearStart = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000)
    return totalsInWindow(poms, yearStart.getTime(), now.getTime())
  }, [poms, now])
  const lifetimeProjectTotals = useMemo(() => projectTotals(poms, projs), [poms, projs])

  const [view, setView] = useState<ViewMode>('today')
  const goal = settings.dailyGoalPomodoros

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink-900 dark:text-ink-50">Insights</h1>
        <p className="text-sm text-ink-500 mt-1">Where your focus is going.</p>
      </header>

      <div className="grid grid-cols-4 rounded-xl bg-ink-100 dark:bg-ink-900 p-1 gap-1">
        {([
          { id: 'today', label: 'Today' },
          { id: 'week', label: 'Week' },
          { id: 'lifetime', label: 'All-time' },
          { id: 'year', label: 'Year' },
        ] as Array<{ id: ViewMode; label: string }>).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={
              'rounded-lg px-3 py-2 text-sm font-medium transition ' +
              (view === t.id
                ? 'bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-50 shadow-sm'
                : 'text-ink-500 hover:text-ink-700 dark:hover:text-ink-200')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'today' && (
        <>
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
            <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Today</h2>
            <div className="text-xs text-ink-500">
              {format(now, 'EEEE, MMMM d')} · {todayPoms.length} session{todayPoms.length === 1 ? '' : 's'} · {fmtDuration(todayStats.seconds)}
            </div>
            <DailyTimeline pomodoros={todayPoms} projects={projs} />
          </section>

          <ProjectsSection totals={last30} title="By project" subtitle="Last 30 days" />
          <StreakAndRate streak={streak} rate={rate.rate} completed={rate.completed} total={rate.total} />
        </>
      )}

      {view === 'week' && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="This Week" sessions={weekStats.count} seconds={weekStats.seconds} accent />
            <StatCard label="Today" sessions={todayStats.count} seconds={todayStats.seconds} />
            <StatCard label="Avg / day (active)" sessions={0} seconds={lifetime.averagePerDay} hideSessions />
          </section>

          <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
            <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">This week</h2>
            <div className="text-xs text-ink-500">
              Mon {format(weekStart, 'MMM d')} – Sun {format(weekEnd, 'MMM d')} · each block is a Pomodoro, colored by project.
            </div>
            <WeeklyStacks pomodoros={weekPoms} projects={projs} weekDays={weekDaysList} />
          </section>

          <ProjectsSection totals={last30} title="By project" subtitle="Last 30 days" />
          <StreakAndRate streak={streak} rate={rate.rate} completed={rate.completed} total={rate.total} />
        </>
      )}

      {view === 'lifetime' && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BigStat label="Total focused" value={lifetime.seconds > 0 ? fmtDuration(lifetime.seconds) : '0m'} hint={`${lifetime.sessions} sessions`} accent />
            <BigStat label="Best streak" value={`${lifetime.bestStreak} day${lifetime.bestStreak === 1 ? '' : 's'}`} hint={lifetime.firstSession ? `since ${format(lifetime.firstSession, 'MMM d, yyyy')}` : ''} />
            <BigStat
              label="Best day"
              value={lifetime.bestDay ? fmtDuration(lifetime.bestDay.seconds) : '—'}
              hint={lifetime.bestDay ? format(new Date(lifetime.bestDay.date + 'T00:00:00'), 'EEE, MMM d, yyyy') : ''}
            />
            <BigStat
              label="Top project"
              value={lifetime.topProject ? lifetime.topProject.project.name : '—'}
              hint={lifetime.topProject ? fmtDuration(lifetime.topProject.seconds) : ''}
              swatch={lifetime.topProject?.project.color}
            />
          </section>

          <ProjectsSection
            totals={lifetimeProjectTotals}
            title="By project (all time)"
            subtitle={`${lifetime.sessions} sessions total`}
          />

          <StreakAndRate streak={streak} rate={rate.rate} completed={rate.completed} total={rate.total} />
        </>
      )}

      {view === 'year' && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Last 365 days" sessions={yearStats.count} seconds={yearStats.seconds} accent />
            <StatCard label="Today" sessions={todayStats.count} seconds={todayStats.seconds} />
            <StatCard label="Best streak" sessions={0} seconds={0} customValue={`${lifetime.bestStreak} day${lifetime.bestStreak === 1 ? '' : 's'}`} hideSessions />
          </section>

          <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
            <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">Year heatmap</h2>
            <p className="text-xs text-ink-500">Each square is one day. Darker = more focused minutes. Hover for details.</p>
            <YearHeatmap cells={heatmap} />
          </section>

          <StreakAndRate streak={streak} rate={rate.rate} completed={rate.completed} total={rate.total} />
        </>
      )}
    </div>
  )
}

function ProjectsSection({ totals, title, subtitle }: { totals: ReturnType<typeof projectTotals>; title: string; subtitle: string }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg text-ink-900 dark:text-ink-50">{title}</h2>
        <span className="text-xs text-ink-500">{subtitle}</span>
      </div>
      <ProjectBars totals={totals} />
    </section>
  )
}

function StreakAndRate({ streak, rate, completed, total }: { streak: number; rate: number; completed: number; total: number }) {
  return (
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
          {Math.round(rate * 100)}%
        </div>
        <div className="text-xs text-ink-500 mt-1">{completed} of {total} finished</div>
      </div>
    </section>
  )
}

function BigStat({ label, value, hint, accent, swatch }: { label: string; value: string; hint: string; accent?: boolean; swatch?: string }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-1 ${accent
      ? 'bg-accent/10 border-accent/30 dark:bg-accent/15'
      : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
      <div className={`text-xs uppercase tracking-wider ${accent ? 'text-accent-strong dark:text-accent-soft' : 'text-ink-500'} flex items-center gap-2`}>
        {swatch && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: swatch }} />}
        {label}
      </div>
      <div className="font-display text-2xl text-ink-900 dark:text-ink-50 tabular truncate">{value}</div>
      {hint && <div className="text-xs text-ink-500">{hint}</div>}
    </div>
  )
}

function StatCard({ label, sessions, seconds, accent, customValue, hideSessions }: { label: string; sessions: number; seconds: number; accent?: boolean; customValue?: string; hideSessions?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 space-y-1 ${accent
      ? 'bg-accent/10 border-accent/30 dark:bg-accent/15'
      : 'bg-white dark:bg-ink-900 border-ink-200 dark:border-ink-800'}`}>
      <div className={`text-xs uppercase tracking-wider ${accent ? 'text-accent-strong dark:text-accent-soft' : 'text-ink-500'}`}>
        {label}
      </div>
      <div className="font-display text-2xl text-ink-900 dark:text-ink-50 tabular">
        {customValue ?? (fmtDuration(seconds) || '0m')}
      </div>
      {!hideSessions && (
        <div className="text-xs text-ink-500">{sessions} session{sessions === 1 ? '' : 's'}</div>
      )}
    </div>
  )
}
