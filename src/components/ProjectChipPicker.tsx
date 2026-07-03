import type { Project } from '../types'

// Single-select project chips: selected chip fills with the project color.
// Shared by the idle timer setup, manual entry, and the session editor.
export function ProjectChipPicker({
  projects,
  value,
  onChange,
  size = 'sm',
  center = false,
}: {
  projects: Project[]
  value: string
  onChange: (id: string) => void
  size?: 'sm' | 'md'
  center?: boolean
}) {
  if (projects.length === 0) return null
  const chipCls = size === 'md' ? 'gap-2 px-3 py-1.5 text-sm' : 'gap-1.5 px-3 py-1.5 text-xs'
  const dotCls = size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5'
  return (
    <div className={`flex flex-wrap ${size === 'md' ? 'gap-2' : 'gap-1.5'} ${center ? 'justify-center' : ''}`}>
      {projects.map(p => {
        const selected = p.id === value
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={
              `inline-flex items-center rounded-full border transition ${chipCls} ` +
              (selected
                ? 'border-transparent text-white shadow-sm'
                : 'border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-700')
            }
            style={selected ? { backgroundColor: p.color } : undefined}
          >
            <span className={`${dotCls} rounded-full`} style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : p.color }} />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}
