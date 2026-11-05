"use client"

import { Button } from "@/components/ui/button"
import { CEFR_HELP, CEFR_LEVELS, type CefrLevel } from "@/lib/types"

export function CefrPicker({
  value,
  onChange,
}: {
  value: CefrLevel
  onChange: (level: CefrLevel) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Level</p>
      <div className="flex flex-wrap gap-2">
        {CEFR_LEVELS.map((level) => (
          <Button
            key={level}
            type="button"
            size="sm"
            variant={value === level ? "default" : "outline"}
            onClick={() => onChange(level)}
          >
            {level}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{CEFR_HELP[value]}</p>
    </div>
  )
}
