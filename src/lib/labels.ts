export const HIDDEN_LABELS = new Set(["want-to-learn"])
const LAST_LABEL_KEY = "kelime.last-word-label"

export function normalizeLabel(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 40)
}

export function parseLabels(value: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(value) ? value : String(value ?? "").split(/[,;]/)
  const seen = new Set<string>()
  const labels: string[] = []
  for (const part of parts) {
    const name = normalizeLabel(part)
    if (!name) continue
    const key = name.toLocaleLowerCase("tr")
    if (seen.has(key)) continue
    seen.add(key)
    labels.push(name)
  }
  return labels
}

export function visibleLabels(tags: string[]) {
  return tags.filter((tag) => !HIDDEN_LABELS.has(tag.toLocaleLowerCase("tr")))
}

export function displayLabel(tag: string) {
  if (tag === "photo") return "From photos"
  return tag
}

export function mergeLabels(existing: string[] | undefined, extra: string[]) {
  return parseLabels([...(existing ?? []), ...extra])
}

export function readLastLabel() {
  try {
    return normalizeLabel(localStorage.getItem(LAST_LABEL_KEY) ?? "")
  } catch {
    return ""
  }
}

export function writeLastLabel(value: string) {
  try {
    const name = normalizeLabel(value)
    if (name) localStorage.setItem(LAST_LABEL_KEY, name)
    else localStorage.removeItem(LAST_LABEL_KEY)
  } catch {
    /* ignore */
  }
}
