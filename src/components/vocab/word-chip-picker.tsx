"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { filterWords } from "@/lib/vocab/search"
import type { WordListItem } from "@/lib/types"

export function ClearSelectionButton({
  selectedCount,
  onClear,
}: {
  selectedCount: number
  onClear: () => void
}) {
  if (selectedCount === 0) return null
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onClear}>
      Clear selection
    </Button>
  )
}

export function WordChipPicker({
  words,
  selected,
  onSelectedChange,
}: {
  words: WordListItem[]
  selected: string[]
  onSelectedChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const visible = useMemo(() => filterWords(words, query), [words, query])
  const searching = query.trim().length > 0

  function toggle(id: string, checked: boolean) {
    onSelectedChange(checked ? [...selected.filter((item) => item !== id), id] : selected.filter((item) => item !== id))
  }

  return (
    <div className="space-y-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Turkish or English"
        aria-label="Search words in Turkish or English"
      />
      <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
        {visible.map((word) => (
          <label key={word.id} className="flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-sm">
            <Checkbox checked={selected.includes(word.id)} onCheckedChange={(checked) => toggle(word.id, Boolean(checked))} />
            {word.turkish}
          </label>
        ))}
        {searching && visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching words</p>
        ) : null}
      </div>
    </div>
  )
}
