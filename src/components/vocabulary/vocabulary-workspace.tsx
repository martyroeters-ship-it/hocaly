"use client"

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { StatusBadge } from "@/components/status-badge"
import { ImportDialog } from "@/components/vocabulary/import-dialog"
import { LabelField } from "@/components/vocabulary/label-field"
import { ScanDialog } from "@/components/vocabulary/scan-dialog"
import {
  filterVerbWords,
  VocabPractice,
  type VocabPracticeMode,
} from "@/components/vocabulary/vocab-practice"
import { api } from "@/lib/client"
import { displayLabel, parseLabels, visibleLabels } from "@/lib/labels"
import { playTurkishAudio } from "@/lib/speech/client-audio"
import { hasTextSelection } from "@/lib/translate/selection"
import type { LearningStatus, WordListItem } from "@/lib/types"
import { CEFR_LEVELS } from "@/lib/types"
import { ChevronDown, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  GeneratePreviewDialog,
  type SentencePreview,
  type StoryPreview,
} from "@/components/vocabulary/generate-dialog"

function practiceFromQuery(value: string | null): VocabPracticeMode | null {
  if (value === "daily" || value === "context" || value === "en-tr" || value === "verbs") return value
  return null
}

const MIN_VERB_PRACTICE = 1

export function VocabularyWorkspace() {
  const params = useSearchParams()
  const [items, setItems] = useState<WordListItem[]>([])
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [tag, setTag] = useState("all")
  const [cefr, setCefr] = useState("all")
  const [sort, setSort] = useState("alpha")
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<WordListItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewKind, setPreviewKind] = useState<"sentence" | "story">("sentence")
  const [sentencePreview, setSentencePreview] = useState<SentencePreview | null>(null)
  const [storyPreview, setStoryPreview] = useState<StoryPreview | null>(null)
  const [libraryLabels, setLibraryLabels] = useState<string[]>([])
  const [bulkLabel, setBulkLabel] = useState("")
  const [scanOpen, setScanOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [practice, setPractice] = useState<VocabPracticeMode | null>(() => practiceFromQuery(params.get("practice")))

  async function load() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (status !== "all") params.set("status", status)
    if (tag !== "all") params.set("tag", tag)
    params.set("sort", sort)
    const data = await api<{ items: WordListItem[]; total: number; labels?: string[] }>(`/api/words?${params}`)
    setItems(data.items)
    setLibraryLabels(data.labels ?? [])
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.message))
  }, [q, status, tag, sort])

  const filtered = useMemo(() => {
    if (cefr === "all") return items
    if (cefr === "Unleveled") return items.filter((item) => !item.cefrLevel)
    return items.filter((item) => item.cefrLevel === cefr)
  }, [items, cefr])
  const toLearn = useMemo(() => filtered.filter((item) => item.correctCount === 0), [filtered])
  const known = useMemo(() => filtered.filter((item) => item.correctCount > 0), [filtered])
  const selectedItems = useMemo(() => filtered.filter((item) => selected.includes(item.id)), [filtered, selected])
  const byLevel = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      const key = item.cefrLevel || "Unleveled"
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  useEffect(() => {
    setPractice(practiceFromQuery(params.get("practice")))
  }, [params])

  async function bulk(payload: Record<string, unknown>) {
    setBusy(true)
    try {
      await api("/api/words/bulk", { method: "POST", body: JSON.stringify({ ids: selected, ...payload }) })
      setSelected([])
      await load()
      toast.success("Updated selected words")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk action failed")
    } finally {
      setBusy(false)
    }
  }

  async function generate(kind: "sentence" | "story") {
    if (!selected.length) return
    setPreviewKind(kind)
    setSentencePreview(null)
    setStoryPreview(null)
    setPreviewOpen(true)
    setBusy(true)
    try {
      if (kind === "sentence") {
        const result = await api<SentencePreview>("/api/ai", {
          method: "POST",
          body: JSON.stringify({ action: "sentences", wordIds: selected }),
        })
        setSentencePreview(result)
      } else {
        const result = await api<StoryPreview>("/api/ai", {
          method: "POST",
          body: JSON.stringify({ action: "story", wordIds: selected, length: 160 }),
        })
        setStoryPreview(result)
      }
    } catch (error) {
      setPreviewOpen(false)
      toast.error(error instanceof Error ? error.message : "Generation failed")
    } finally {
      setBusy(false)
    }
  }

  async function savePreview() {
    if (!selected.length) return
    setBusy(true)
    try {
      if (previewKind === "sentence" && sentencePreview) {
        await api("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "save-sentence",
            wordIds: selected,
            turkish: sentencePreview.turkish,
            english: sentencePreview.english,
            usedWords: sentencePreview.usedWords,
          }),
        })
        toast.success("Sentence saved")
      } else if (storyPreview) {
        await api("/api/ai", {
          method: "POST",
          body: JSON.stringify({
            action: "save-story",
            wordIds: selected,
            ...storyPreview,
            length: 160,
          }),
        })
        toast.success("Story saved — open Stories to read it again")
      }
      setPreviewOpen(false)
      setSentencePreview(null)
      setStoryPreview(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  if (practice) {
    return (
      <div>
        <PageHero
          title="Vocabulary practice"
          subtitle="New words + old reviews, always preferring sentence context."
        />
        <PageBody className="space-y-5">
          <VocabPractice mode={practice} words={filtered} onClose={() => setPractice(null)} />
        </PageBody>
      </div>
    )
  }

  return (
    <div>
      <PageHero title="Vocabulary" />

      <PageBody className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={cefr === "all" ? "default" : "outline"} onClick={() => setCefr("all")}>
          All levels ({items.length})
        </Button>
        {CEFR_LEVELS.map((level) => {
          const count = byLevel.find(([key]) => key === level)?.[1] ?? 0
          if (!count && level !== "A1" && level !== "A2") return null
          return (
            <Button
              key={level}
              size="sm"
              variant={cefr === level ? "default" : "outline"}
              onClick={() => setCefr(level)}
            >
              {level} ({count})
            </Button>
          )
        })}
        {(byLevel.find(([key]) => key === "Unleveled")?.[1] ?? 0) > 0 ? (
          <Button
            size="sm"
            variant={cefr === "Unleveled" ? "default" : "outline"}
            onClick={() => setCefr("Unleveled")}
          >
            Unleveled ({byLevel.find(([key]) => key === "Unleveled")?.[1]})
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" />}>
            Practice
            <ChevronDown className="size-4 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setPractice("daily")}>Daily words</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPractice("context")}>Meaning in context</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPractice("en-tr")}>English → Turkish</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const verbs = filterVerbWords(filtered)
                if (verbs.length < MIN_VERB_PRACTICE) {
                  toast.error("No verbs in the current list. Import verbs or clear filters.")
                  return
                }
                setPractice("verbs")
              }}
            >
              Verbs only
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setScanOpen(true)}>From photo</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>Import</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!selected.length || busy} onClick={() => void generate("sentence")}>
              Generate sentence
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!selected.length || busy} onClick={() => void generate("story")}>
              Generate story
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onImported={load} labels={libraryLabels} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={load} labels={libraryLabels} />

      <GeneratePreviewDialog
        open={previewOpen}
        kind={previewKind}
        busy={busy}
        sentence={sentencePreview}
        story={storyPreview}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) {
            setSentencePreview(null)
            setStoryPreview(null)
          }
        }}
        onSave={savePreview}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Search Turkish or English" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={(value) => setStatus(String(value))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {{ all: "All statuses", new: "New", learning: "Learning", reviewing: "Reviewing", mastered: "Mastered" }[status]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="mastered">Mastered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={(value) => setTag(String(value))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>{tag === "all" ? "All labels" : displayLabel(tag)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All labels</SelectItem>
            {visibleLabels(libraryLabels).map((name) => (
              <SelectItem key={name} value={name}>
                {displayLabel(name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(String(value))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {{ alpha: "A–Z", next: "Next review", reviews: "Most reviewed", status: "Status" }[sort]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">A–Z</SelectItem>
            <SelectItem value="next">Next review</SelectItem>
            <SelectItem value="reviews">Most reviewed</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
          <span>{selected.length} selected</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setPractice("context")}>
            Practice selected in context
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => (window.location.href = `/dialogue?ids=${selected.join(",")}`)}>
            Dialogue
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk({ learningStatus: "learning" satisfies LearningStatus })}>
            Mark learning
          </Button>
          <LabelField compact value={bulkLabel} onChange={setBulkLabel} suggestions={libraryLabels} />
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              const names = parseLabels(bulkLabel)
              if (!names.length) {
                toast.error("Type a label first, for example Chapter 1")
                return
              }
              void bulk({ tags: names })
            }}
          >
            Add label
          </Button>
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => bulk({ deleteWords: true })}>
            Delete
          </Button>
        </div>
      )}

      {status === "all" ? (
        <div className="space-y-5">
          <WordGroup
            title="Still to learn"
            description="Not answered correctly yet."
            empty="Words you miss in tests stay here until you get them right."
            items={toLearn}
            selected={selected}
            setSelected={setSelected}
            setActive={setActive}
          />
          <WordGroup
            title="Known"
            description="Answered correctly in a test or review."
            empty="Correct answers move here."
            items={known}
            selected={selected}
            setSelected={setSelected}
            setActive={setActive}
          />
        </div>
      ) : (
        <WordGroup
          items={filtered}
          empty="No words yet. Photograph highlighted text, import a list, or load the sample set from Settings."
          selected={selected}
          setSelected={setSelected}
          setActive={setActive}
        />
      )}

      <Sheet open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent className="gap-0 overflow-y-auto p-6 pt-12 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          {active && (
            <WordEditor
              key={active.id}
              word={active}
              onClose={() => setActive(null)}
              onExample={(example) => {
                setItems((current) =>
                  current.map((item) =>
                    item.id === example.wordId
                      ? {
                          ...item,
                          example: {
                            id: example.id || item.example?.id || example.wordId,
                            turkish: example.turkish,
                            english: example.english,
                            highlight: example.highlight ?? item.example?.highlight ?? null,
                          },
                        }
                      : item,
                  ),
                )
              }}
              onSaved={async () => {
                await load()
                setActive(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>
      <p className="hidden">{selectedItems.length}</p>
      </PageBody>
    </div>
  )
}

function WordGroup({
  title,
  description,
  empty,
  items,
  selected,
  setSelected,
  setActive,
}: {
  title?: string
  description?: string
  empty: string
  items: WordListItem[]
  selected: string[]
  setSelected: Dispatch<SetStateAction<string[]>>
  setActive: (word: WordListItem) => void
}) {
  const allChecked = items.length > 0 && items.every((item) => selected.includes(item.id))
  return (
    <div>
      {title && (
        <div className="mb-2">
          <h2 className="font-heading text-lg tracking-tight">
            {title}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{items.length}</span>
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(checked) =>
                    setSelected((current) => {
                      const ids = new Set(items.map((item) => item.id))
                      if (checked) return [...new Set([...current, ...ids])]
                      return current.filter((id) => !ids.has(id))
                    })
                  }
                />
              </TableHead>
              <TableHead>Turkish</TableHead>
              <TableHead>English</TableHead>
              <TableHead>POS</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Next</TableHead>
              <TableHead>Accuracy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => {
                  if (hasTextSelection()) return
                  setActive(item)
                }}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <span className="select-text">{item.turkish}</span>
                  {visibleLabels(item.tags).map((name) => (
                    <Badge key={name} variant="secondary" className="ml-2">
                      {displayLabel(name)}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>{item.english || <span className="text-muted-foreground">Needs translation</span>}</TableCell>
                <TableCell>{item.partOfSpeech ?? "—"}</TableCell>
                <TableCell>{item.cefrLevel ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={item.learningStatus} />
                </TableCell>
                <TableCell>{item.reviewCount}</TableCell>
                <TableCell>{item.nextReviewAt ? new Date(item.nextReviewAt).toLocaleDateString() : "—"}</TableCell>
                <TableCell>{item.accuracy == null ? "—" : `${item.accuracy}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p>}
      </div>
    </div>
  )
}

type WordExampleResult = {
  wordId: string
  id: string
  turkish: string
  english: string
  highlight: string | null
  reused: boolean
}

function WordEditor({
  word,
  onClose,
  onSaved,
  onExample,
}: {
  word: WordListItem
  onClose: () => void
  onSaved: () => Promise<void>
  onExample: (example: WordExampleResult) => void
}) {
  const [english, setEnglish] = useState(word.meanings.join("; "))
  const [notes, setNotes] = useState(word.notes ?? "")
  const [tags, setTags] = useState(word.tags)
  const [tagDraft, setTagDraft] = useState("")
  const [forms, setForms] = useState<{ form: string; label: string; verified?: boolean }[]>([])
  const [example, setExample] = useState(word.example)
  const [generating, setGenerating] = useState(!word.example)

  async function requestExample(refresh = false) {
    const result = await api<{ items: WordExampleResult[] }>("/api/ai", {
      method: "POST",
      body: JSON.stringify({ action: "word-examples", wordIds: [word.id], refresh }),
    })
    const next = result.items[0]
    if (!next?.turkish) throw new Error("No example sentence returned")
    setExample({
      id: next.id,
      turkish: next.turkish,
      english: next.english,
      highlight: next.highlight,
    })
    onExample(next)
    return next
  }

  useEffect(() => {
    if (word.example) return
    let cancelled = false
    setGenerating(true)
    requestExample(false)
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not generate an example")
      })
      .finally(() => {
        if (!cancelled) setGenerating(false)
      })
    return () => {
      cancelled = true
    }
    // Generate once per open when this word has no stored example yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id])

  async function save() {
    await api(`/api/words/${word.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        english: english.split(";")[0]?.trim(),
        meanings: english.split(";").map((item) => item.trim()).filter(Boolean),
        notes,
        tags,
      }),
    })
    toast.success("Saved")
    await onSaved()
  }

  async function loadForms() {
    const result = await api<{ forms: { form: string; label: string; verified?: boolean }[] }>("/api/ai", {
      method: "POST",
      body: JSON.stringify({ action: "forms", wordIds: [word.id] }),
    })
    setForms(result.forms)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-6">
      <SheetHeader className="space-y-0 p-0 pr-10">
        <SheetTitle className="flex items-center gap-3 text-4xl font-black tracking-tight">
          <span className="select-text">{word.turkish}</span>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-sm font-semibold"
            onClick={() => {
              playTurkishAudio(word.turkish).catch((error) =>
                toast.error(error instanceof Error ? error.message : "Could not play audio"),
              )
            }}
          >
            <Volume2 />
            Listen
          </Button>
        </SheetTitle>
      </SheetHeader>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={word.learningStatus} />
        {word.partOfSpeech && <Badge variant="secondary">{word.partOfSpeech}</Badge>}
        {word.cefrLevel && <Badge variant="outline">{word.cefrLevel}</Badge>}
        {visibleLabels(tags).map((tag) => (
          <button
            key={tag}
            type="button"
            className="inline-flex"
            onClick={() => setTags((current) => current.filter((item) => item !== tag))}
          >
            <Badge variant="outline">{displayLabel(tag)} ×</Badge>
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const names = parseLabels(tagDraft)
          if (!names.length) return
          setTags((current) => parseLabels([...current, ...names]))
          setTagDraft("")
        }}
      >
        <Input value={tagDraft} placeholder="Add label, e.g. Chapter 1" onChange={(event) => setTagDraft(event.target.value)} />
        <Button type="submit" variant="outline">
          Add
        </Button>
      </form>
      <label className="block text-sm">
        English meanings (separate with semicolons)
        <Input className="mt-1" value={english} onChange={(e) => setEnglish(e.target.value)} />
      </label>
      <label className="block text-sm">
        Notes
        <Textarea className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="min-h-[4.75rem] shrink-0 overflow-visible rounded-lg bg-muted/60 p-4 text-sm">
        {generating ? (
          <p className="text-muted-foreground">Generating example sentence…</p>
        ) : example ? (
          <>
            <p>{example.turkish}</p>
            <p className="mt-1 text-muted-foreground">{example.english}</p>
          </>
        ) : (
          <p className="text-muted-foreground">Generating example sentence…</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2.5 pb-2">
        <Button onClick={save}>Save edits</Button>
        <Button
          variant="outline"
          disabled={generating}
          onClick={async () => {
            setGenerating(true)
            try {
              await requestExample(true)
              toast.success("Sentence saved")
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not generate an example")
            } finally {
              setGenerating(false)
            }
          }}
        >
          New sentence
        </Button>
        <Button variant="outline" onClick={loadForms}>
          Word forms
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await api("/api/reviews", { method: "POST", body: JSON.stringify({ wordId: word.id, reset: true }) })
            toast.success("Progress reset")
            await onSaved()
          }}
        >
          Reset progress
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {forms.length > 0 && (
        <ul className="space-y-1 text-sm">
          {forms.map((form) => (
            <li key={form.form} className="flex justify-between gap-2 rounded-md bg-muted/50 px-2 py-1">
              <span>{form.form}</span>
              <span className="text-muted-foreground">{form.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
