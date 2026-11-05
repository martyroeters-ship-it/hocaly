import { displayLabel, visibleLabels } from "@/lib/labels"
import { CEFR_LEVELS, type CefrLevel, type WordListItem } from "@/lib/types"
import { shufflePick, toLearnIds } from "@/lib/vocab/groups"

export const DAILY_STUDY_PREFS_KEY = "daily-study-prefs"

export const DAILY_STUDY_MINUTES = [10, 20, 30, 45] as const
export type DailyStudyMinutes = (typeof DAILY_STUDY_MINUTES)[number]

export const DAILY_STUDY_SKILL_IDS = ["words", "listening", "speaking", "reading"] as const
export type DailyStudySkill = (typeof DAILY_STUDY_SKILL_IDS)[number]

export const DAILY_STUDY_SKILLS: { id: DailyStudySkill; label: string; help: string }[] = [
  { id: "words", label: "Words", help: "Recall / tests" },
  { id: "listening", label: "Listening", help: "Short clips" },
  { id: "speaking", label: "Speaking", help: "Say it out loud" },
  { id: "reading", label: "Reading", help: "Stories" },
]

export const DAILY_STUDY_FOCUS_IDS = ["to-learn", "mixed", "known"] as const
export type DailyStudyFocus = (typeof DAILY_STUDY_FOCUS_IDS)[number]

export const DAILY_STUDY_FOCUSES: { id: DailyStudyFocus; label: string }[] = [
  { id: "to-learn", label: "Still to learn" },
  { id: "mixed", label: "Mixed" },
  { id: "known", label: "Known" },
]

export type DailyStudyCefr = CefrLevel | "any"

export type DailyStudyPrefs = {
  minutes: DailyStudyMinutes
  skills: DailyStudySkill[]
  focus: DailyStudyFocus
  cefr: DailyStudyCefr
  label: string
}

export const DEFAULT_DAILY_STUDY_PREFS: DailyStudyPrefs = {
  minutes: 20,
  skills: ["words", "listening"],
  focus: "to-learn",
  cefr: "any",
  label: "",
}

export type DailyStudyWord = {
  id: string
  correctCount?: number
  cefrLevel?: string | null
  tags?: string[]
}

type QueryInput = URLSearchParams | Record<string, string | string[] | undefined>

function readParam(input: QueryInput, key: string) {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined
  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

export function parseMinutes(value: string | number | undefined | null): DailyStudyMinutes {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_DAILY_STUDY_PREFS.minutes
  return DAILY_STUDY_MINUTES.reduce((best, item) =>
    Math.abs(item - n) < Math.abs(best - n) ? item : best,
  )
}

export function parseDailyStudySkills(value: string | string[] | undefined | null): DailyStudySkill[] {
  const raw = Array.isArray(value) ? value.join(",") : String(value ?? "")
  const picked = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is DailyStudySkill => DAILY_STUDY_SKILL_IDS.includes(item as DailyStudySkill))
  const unique = DAILY_STUDY_SKILL_IDS.filter((id) => picked.includes(id))
  return unique.length ? unique : [...DEFAULT_DAILY_STUDY_PREFS.skills]
}

export function toggleDailyStudySkill(skills: DailyStudySkill[], skill: DailyStudySkill): DailyStudySkill[] {
  const has = skills.includes(skill)
  if (has) {
    const next = skills.filter((item) => item !== skill)
    return next.length ? next : skills
  }
  return DAILY_STUDY_SKILL_IDS.filter((id) => id === skill || skills.includes(id))
}

export function normalizeDailyStudyPrefs(input: Partial<DailyStudyPrefs> | null | undefined): DailyStudyPrefs {
  const minutes = parseMinutes(input?.minutes)
  const skills = parseDailyStudySkills(input?.skills)
  const focus = DAILY_STUDY_FOCUS_IDS.includes(input?.focus as DailyStudyFocus)
    ? (input?.focus as DailyStudyFocus)
    : DEFAULT_DAILY_STUDY_PREFS.focus
  const cefr =
    input?.cefr === "any" || CEFR_LEVELS.includes(input?.cefr as CefrLevel)
      ? (input?.cefr as DailyStudyCefr)
      : DEFAULT_DAILY_STUDY_PREFS.cefr
  const label = typeof input?.label === "string" ? input.label.trim().slice(0, 40) : ""
  return { minutes, skills, focus, cefr, label }
}

export function parseDailyStudyPrefs(raw: unknown): DailyStudyPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DAILY_STUDY_PREFS, skills: [...DEFAULT_DAILY_STUDY_PREFS.skills] }
  return normalizeDailyStudyPrefs(raw as Partial<DailyStudyPrefs>)
}

export function hasDailyStudyQuery(input: QueryInput) {
  return Boolean(
    readParam(input, "minutes") ||
      readParam(input, "skills") ||
      readParam(input, "focus") ||
      readParam(input, "cefr") ||
      readParam(input, "label"),
  )
}

export function parseDailyStudyQuery(input: QueryInput): DailyStudyPrefs {
  return normalizeDailyStudyPrefs({
    minutes: parseMinutes(readParam(input, "minutes")),
    skills: parseDailyStudySkills(readParam(input, "skills")),
    focus: readParam(input, "focus") as DailyStudyFocus,
    cefr: readParam(input, "cefr") as DailyStudyCefr,
    label: readParam(input, "label") ?? "",
  })
}

export function dailyStudyPrefsFromQuery(input: QueryInput): DailyStudyPrefs | null {
  return hasDailyStudyQuery(input) ? parseDailyStudyQuery(input) : null
}

export function dailyStudySearchParams(prefs: DailyStudyPrefs, extra?: Record<string, string>) {
  const params = new URLSearchParams()
  const normalized = normalizeDailyStudyPrefs(prefs)
  params.set("minutes", String(normalized.minutes))
  params.set("skills", normalized.skills.join(","))
  params.set("focus", normalized.focus)
  params.set("cefr", normalized.cefr)
  if (normalized.label) params.set("label", normalized.label)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value)
    }
  }
  return params.toString()
}

export function wordCountForMinutes(minutes: number) {
  return Math.max(4, Math.round((minutes / 10) * 8))
}

export function listeningClipSec(minutes: number) {
  if (minutes <= 10) return 60
  if (minutes <= 20) return 90
  return 120
}

export function speakingDurationSec(minutes: number) {
  if (minutes <= 10) return 60
  if (minutes <= 20) return 120
  if (minutes <= 30) return 180
  return 300
}

export function storyLengthForMinutes(minutes: number) {
  if (minutes <= 10) return 100
  if (minutes <= 20) return 160
  if (minutes <= 30) return 220
  return 280
}

export function dailyStudyHref(prefs: DailyStudyPrefs) {
  const normalized = normalizeDailyStudyPrefs(prefs)
  if (normalized.skills.length === 1) {
    const skill = normalized.skills[0]
    if (skill === "words") {
      return `/tests/study?${dailyStudySearchParams(normalized, {
        start: "1",
        count: String(wordCountForMinutes(normalized.minutes)),
      })}`
    }
    if (skill === "listening") return `/listen?${dailyStudySearchParams(normalized)}`
    if (skill === "speaking") return `/speak?${dailyStudySearchParams(normalized)}`
    return `/stories?${dailyStudySearchParams(normalized)}`
  }
  return `/study?${dailyStudySearchParams(normalized)}`
}

export function skillLabel(id: DailyStudySkill) {
  return DAILY_STUDY_SKILLS.find((item) => item.id === id)?.label ?? id
}

export function focusLabel(id: DailyStudyFocus) {
  return DAILY_STUDY_FOCUSES.find((item) => item.id === id)?.label ?? id
}

export function filterWordsByPrefs<T extends DailyStudyWord>(
  words: T[],
  prefs: Pick<DailyStudyPrefs, "focus" | "cefr" | "label">,
): T[] {
  let pool = words
  if (prefs.label) {
    const key = prefs.label.toLocaleLowerCase("tr")
    const tagged = pool.filter((word) =>
      (word.tags ?? []).some((tag) => tag.toLocaleLowerCase("tr") === key),
    )
    if (tagged.length) pool = tagged
  }
  if (prefs.cefr !== "any") {
    const leveled = pool.filter((word) => word.cefrLevel === prefs.cefr)
    if (leveled.length) pool = leveled
  }
  if (prefs.focus === "to-learn") {
    const ids = new Set(toLearnIds(pool))
    const fresh = pool.filter((word) => ids.has(word.id))
    if (fresh.length) pool = fresh
  } else if (prefs.focus === "known") {
    const known = pool.filter((word) => (word.correctCount ?? 0) > 0)
    if (known.length) pool = known
  }
  return pool
}

export function pickDailyStudyWords(
  words: DailyStudyWord[],
  prefs: DailyStudyPrefs,
  count = wordCountForMinutes(prefs.minutes),
) {
  return shufflePick(
    filterWordsByPrefs(words, prefs).map((word) => word.id),
    count,
  )
}

export function libraryLabels(words: Pick<WordListItem, "tags">[]) {
  const seen = new Set<string>()
  const labels: { value: string; label: string }[] = []
  for (const word of words) {
    for (const tag of visibleLabels(word.tags ?? [])) {
      const key = tag.toLocaleLowerCase("tr")
      if (seen.has(key)) continue
      seen.add(key)
      labels.push({ value: tag, label: displayLabel(tag) })
    }
  }
  return labels.sort((a, b) => a.label.localeCompare(b.label, "en"))
}

export function readDailyStudyPrefs(): DailyStudyPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(DAILY_STUDY_PREFS_KEY)
    if (!raw) return normalizeDailyStudyPrefs(DEFAULT_DAILY_STUDY_PREFS)
    return parseDailyStudyPrefs(JSON.parse(raw))
  } catch {
    return normalizeDailyStudyPrefs(DEFAULT_DAILY_STUDY_PREFS)
  }
}

export function writeDailyStudyPrefs(prefs: DailyStudyPrefs) {
  try {
    globalThis.localStorage?.setItem(DAILY_STUDY_PREFS_KEY, JSON.stringify(normalizeDailyStudyPrefs(prefs)))
  } catch {
    /* ignore quota / private mode */
  }
}
