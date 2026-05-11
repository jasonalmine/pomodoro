import type { Project } from '../types'

export function ProjectChip({ project, className = '' }: { project: Project; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
      style={{ backgroundColor: `${project.color}1a`, color: project.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: project.color }} />
      {project.name}
    </span>
  )
}
