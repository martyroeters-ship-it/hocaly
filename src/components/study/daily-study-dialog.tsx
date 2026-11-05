"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/client"
import { parseCefrLevel } from "@/lib/cefr"
import {
  DAILY_STUDY_FOCUSES,
  DAILY_STUDY_MINUTES,
  DAILY_STUDY_SKILLS,
  dailyStudyHref,
  libraryLabels,
  readDailyStudyPrefs,
  toggleDailyStudySkill,
  writeDailyStudyPrefs,
  type DailyStudyCefr,
  type DailyStudyFocus,
  type DailyStudyMinutes,
  type DailyStudyPrefs,
  type DailyStudySkill,
} from "@/lib/daily-study"
import { CEFR_LEVELS, type WordListItem } from "@/lib/types"

function Chip({
  selected,
  children,
  onClick,
  title,
}: {
  selected: boolean
  children: ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <Button type="button" size="sm" variant={selected ? "default" : "outline"} title={title} onClick={onClick}>
      {children}
    </Button>
  )
}

export function DailyStudyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<DailyStudyPrefs>(readDailyStudyPrefs)
  const [labels, setLabels] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    if (!open) return
    setPrefs(readDailyStudyPrefs())
    Promise.all([
      api<{ items: WordListItem[] }>("/api/words?take=400"),
      api<{ settings?: { cefrDefault?: string } }>("/api/settings"),
    ])
      .then(([data, settings]) => {
        const next = libraryLabels(data.items)
        const profileCefr = parseCefrLevel(settings.settings?.cefrDefault)
        setLabels(next)
        setPrefs((current) => {
          let prefs = current
          if (current.label && !next.some((item) => item.value === current.label)) {
            prefs = { ...prefs, label: "" }
          }
          if (prefs.cefr === "any") prefs = { ...prefs, cefr: profileCefr }
          return prefs
        })
      })
      .catch(() => setLabels([]))
  }, [open])

  function start() {
    writeDailyStudyPrefs(prefs)
    onOpenChange(false)
    router.push(dailyStudyHref(prefs))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Start daily study</DialogTitle>
          <DialogDescription>Choose a time, what to practice, and a focus. Last choices are remembered.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Time</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_STUDY_MINUTES.map((minutes) => (
                <Chip
                  key={minutes}
                  selected={prefs.minutes === minutes}
                  onClick={() => setPrefs((current) => ({ ...current, minutes: minutes as DailyStudyMinutes }))}
                >
                  {minutes} min
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What to practice</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_STUDY_SKILLS.map((skill) => (
                <Chip
                  key={skill.id}
                  selected={prefs.skills.includes(skill.id)}
                  title={skill.help}
                  onClick={() =>
                    setPrefs((current) => ({
                      ...current,
                      skills: toggleDailyStudySkill(current.skills, skill.id as DailyStudySkill),
                    }))
                  }
                >
                  {skill.label}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Words is recall / tests. Pick at least one.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Focus</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_STUDY_FOCUSES.map((item) => (
                <Chip
                  key={item.id}
                  selected={prefs.focus === item.id}
                  onClick={() => setPrefs((current) => ({ ...current, focus: item.id as DailyStudyFocus }))}
                >
                  {item.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Level</p>
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={prefs.cefr === "any"}
                onClick={() => setPrefs((current) => ({ ...current, cefr: "any" }))}
              >
                Any
              </Chip>
              {CEFR_LEVELS.map((level) => (
                <Chip
                  key={level}
                  selected={prefs.cefr === level}
                  onClick={() => setPrefs((current) => ({ ...current, cefr: level as DailyStudyCefr }))}
                >
                  {level}
                </Chip>
              ))}
            </div>
          </div>

          {labels.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Label</p>
              <div className="flex flex-wrap gap-2">
                <Chip selected={!prefs.label} onClick={() => setPrefs((current) => ({ ...current, label: "" }))}>
                  Any
                </Chip>
                {labels.map((item) => (
                  <Chip
                    key={item.value}
                    selected={prefs.label === item.value}
                    onClick={() => setPrefs((current) => ({ ...current, label: item.value }))}
                  >
                    {item.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={start} disabled={!prefs.skills.length}>
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StartDailyStudyButton({
  size = "lg",
  className,
}: {
  size?: "default" | "lg"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)}>
        Start Daily Study
      </Button>
      <DailyStudyDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
