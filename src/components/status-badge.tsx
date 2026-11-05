import { Badge } from "@/components/ui/badge"

const LABELS: Record<string, string> = {
  new: "New",
  learning: "Learning",
  reviewing: "Reviewing",
  mastered: "Mastered",
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "mastered" ? "default" : status === "new" ? "outline" : status === "learning" ? "secondary" : "outline"
  return <Badge variant={variant}>{LABELS[status] ?? status}</Badge>
}
