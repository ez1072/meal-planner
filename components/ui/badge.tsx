import { cn } from '@/lib/utils'

const colorMap: Record<string, string> = {
  Easy: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Hard: 'bg-red-100 text-red-700',
  Italian: 'bg-red-50 text-red-600',
  Asian: 'bg-orange-50 text-orange-600',
  Mexican: 'bg-yellow-50 text-yellow-700',
  Mediterranean: 'bg-blue-50 text-blue-600',
  American: 'bg-indigo-50 text-indigo-600',
  Indian: 'bg-amber-50 text-amber-700',
  Other: 'bg-gray-100 text-gray-600',
  lunch: 'bg-sky-100 text-sky-700',
  dinner: 'bg-violet-100 text-violet-700',
}

interface BadgeProps {
  label: string
  className?: string
  colorKey?: string
}

export function Badge({ label, className, colorKey }: BadgeProps) {
  const key = colorKey ?? label
  const color = colorMap[key] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color, className)}>
      {label}
    </span>
  )
}
