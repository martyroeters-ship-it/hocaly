export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function startOfDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfDay(date = new Date()): Date {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}
