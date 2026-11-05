"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { visibleLabels } from "@/lib/labels"

export function LabelField({
  value,
  onChange,
  suggestions = [],
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  suggestions?: string[]
  compact?: boolean
}) {
  const listId = useId()
  const options = visibleLabels(suggestions).filter((name) => name !== "photo")

  return (
    <label className={compact ? "flex min-w-40 flex-1 items-center gap-2 text-sm" : "block space-y-1 text-sm"}>
      <span className={compact ? "shrink-0" : undefined}>Label</span>
      <Input
        list={listId}
        value={value}
        placeholder="Chapter 1"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Optional. Use the same label for every photo from one chapter, then change it for the next.
        </p>
      )}
    </label>
  )
}
