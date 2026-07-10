export const WEEKDAY_SHORT_ES = [
  'Dom',
  'Lun',
  'Mar',
  'Mié',
  'Jue',
  'Vie',
  'Sáb',
]

export function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function formatMinutes(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

export function formatTimeRange(startsAt: Date, endsAt: Date): string {
  const fmt = (dt: Date) =>
    dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${fmt(startsAt)} – ${fmt(endsAt)}`
}

export function formatDateLine(d: Date): string {
  return d.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
