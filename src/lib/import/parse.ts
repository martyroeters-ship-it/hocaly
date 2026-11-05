import { dictionaryFormGuess, looksLikeVerb, normalizeTurkish } from "@/lib/turkish"
import {
  CEFR_LEVELS,
  PARTS_OF_SPEECH,
  type CefrLevel,
  type ParsedImportRow,
  type PartOfSpeech,
} from "@/lib/types"

const CEFR_SET = new Set<string>(CEFR_LEVELS)
const POS_SET = new Set<string>(PARTS_OF_SPEECH)

const POS_ALIASES: Record<string, PartOfSpeech> = {
  noun: "noun",
  n: "noun",
  isim: "noun",
  verb: "verb",
  v: "verb",
  fiil: "verb",
  adjective: "adjective",
  adj: "adjective",
  sıfat: "adjective",
  sifat: "adjective",
  adverb: "adverb",
  adv: "adverb",
  zarf: "adverb",
  expression: "expression",
  phrase: "expression",
  deyim: "expression",
  other: "other",
}

export function guessPartOfSpeech(word: string): PartOfSpeech | undefined {
  const trimmed = word.trim()
  if (!trimmed) return undefined
  if (/\s/.test(trimmed)) return "expression"
  if (looksLikeVerb(trimmed)) return "verb"
  return undefined
}

function parsePos(value?: string): PartOfSpeech | undefined {
  if (!value) return undefined
  const key = normalizeTurkish(value).replace(/\./g, "")
  return POS_ALIASES[key] ?? (POS_SET.has(key) ? (key as PartOfSpeech) : undefined)
}

function parseCefr(value?: string): CefrLevel | undefined {
  if (!value) return undefined
  const key = value.trim().toUpperCase()
  return CEFR_SET.has(key) ? (key as CefrLevel) : undefined
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  out.push(current.trim())
  return out
}

function detectDelimiter(sample: string): "," | ";" | "\t" {
  const tab = (sample.match(/\t/g) ?? []).length
  const semi = (sample.match(/;/g) ?? []).length
  const comma = (sample.match(/,/g) ?? []).length
  if (tab >= semi && tab >= comma && tab > 0) return "\t"
  if (semi > comma) return ";"
  return ","
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.map((c) => normalizeTurkish(c)).join(" ")
  return /(turkish|turkce|türkçe|english|ingilizce|word|translation|cefr|pos|tag)/.test(
    joined,
  )
}

function headerIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map((h) => normalizeTurkish(h))
  return normalized.findIndex((h) => aliases.some((alias) => h.includes(alias)))
}

function cleanPair(turkish: string, english?: string): { turkish: string; english?: string } | null {
  const tr = turkish.replace(/^\uFEFF/, "").trim()
  if (!tr || tr.startsWith("#")) return null
  const en = english?.trim()
  return { turkish: tr, english: en || undefined }
}

function parseJson(text: string): ParsedImportRow[] {
  const data = JSON.parse(text) as unknown
  const rows: ParsedImportRow[] = []

  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { words?: unknown }).words)
      ? (data as { words: unknown[] }).words
      : null

  if (!items) {
    throw new Error("JSON import must be an array, or an object with a words array.")
  }

  items.forEach((item, index) => {
    if (typeof item === "string") {
      const cleaned = cleanPair(item)
      if (cleaned) {
        rows.push({
          turkish: cleaned.turkish,
          partOfSpeech: guessPartOfSpeech(cleaned.turkish),
          lineNumber: index + 1,
        })
      }
      return
    }
    if (!item || typeof item !== "object") return
    const rec = item as Record<string, unknown>
    const turkish = String(rec.turkish ?? rec.tr ?? rec.word ?? rec.kelime ?? "")
    const english = rec.english ?? rec.en ?? rec.translation ?? rec.anlam
    const extra = rec.meanings ?? rec.extraMeanings
    const tags = rec.tags
    const cleaned = cleanPair(turkish, english == null ? undefined : String(english))
    if (!cleaned) return
    const collocations = rec.collocations
    const frequencyRank = Number(rec.frequencyRank ?? rec.frequency ?? rec.rank)
    const cefrSourceRaw = String(rec.cefrSource ?? "").toLowerCase()
    rows.push({
      turkish: cleaned.turkish,
      english: cleaned.english,
      extraMeanings: Array.isArray(extra) ? extra.map(String) : undefined,
      tags: Array.isArray(tags) ? tags.map(String) : undefined,
      cefrLevel: parseCefr(rec.cefrLevel ? String(rec.cefrLevel) : rec.cefr ? String(rec.cefr) : undefined),
      cefrSource:
        cefrSourceRaw === "verified" || cefrSourceRaw === "estimate" || cefrSourceRaw === "user"
          ? cefrSourceRaw
          : undefined,
      frequencyRank: Number.isFinite(frequencyRank) ? frequencyRank : undefined,
      collocations: Array.isArray(collocations)
        ? collocations.map(String)
        : typeof collocations === "string"
          ? collocations.split(/[;|]/).map((item) => item.trim()).filter(Boolean)
          : undefined,
      grammarNotes: rec.grammarNotes ? String(rec.grammarNotes) : undefined,
      notes: rec.notes ? String(rec.notes) : undefined,
      partOfSpeech:
        parsePos(rec.partOfSpeech ? String(rec.partOfSpeech) : rec.pos ? String(rec.pos) : undefined) ??
        guessPartOfSpeech(cleaned.turkish),
      lineNumber: index + 1,
    })
  })

  return rows
}

function lineDelimiter(line: string): "," | ";" | "\t" | null {
  if (line.includes("\t")) return "\t"
  if (line.includes(";")) return ";"
  if (line.includes(",")) return ","
  return null
}

function parseDelimited(text: string, filename?: string): ParsedImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
  const sample = lines.slice(0, 8).join("\n")
  const namedCsv = /\.(csv|tsv|tab)$/i.test(filename ?? "")
  const delimiter =
    filename?.toLowerCase().endsWith(".tsv") || filename?.toLowerCase().endsWith(".tab")
      ? "\t"
      : namedCsv
        ? detectDelimiter(sample)
        : detectDelimiter(sample)

  let start = 0
  let turkishIdx = 0
  let englishIdx = 1
  let posIdx = -1
  let cefrIdx = -1
  let cefrSourceIdx = -1
  let frequencyIdx = -1
  let collocationsIdx = -1
  let tagsIdx = -1

  const firstCells = splitCsvLine(lines[0] ?? "", delimiter)
  if (firstCells.length > 1 && looksLikeHeader(firstCells)) {
    start = 1
    turkishIdx = Math.max(0, headerIndex(firstCells, ["turkish", "turkce", "türkçe", "kelime", "word"]))
    englishIdx = headerIndex(firstCells, ["english", "ingilizce", "translation", "meaning", "anlam"])
    posIdx = headerIndex(firstCells, ["pos", "part of speech", "partofspeech", "tur"])
    cefrIdx = headerIndex(firstCells, ["cefr", "level", "seviye"])
    cefrSourceIdx = headerIndex(firstCells, ["cefrsource", "cefr source", "source"])
    frequencyIdx = headerIndex(firstCells, ["frequencyrank", "frequency", "rank"])
    collocationsIdx = headerIndex(firstCells, ["collocations", "collocation"])
    tagsIdx = headerIndex(firstCells, ["tag", "etiket", "category"])
  }

  const rows: ParsedImportRow[] = []
  for (let i = start; i < lines.length; i += 1) {
    const raw = lines[i]?.trim()
    if (!raw) continue
    const rowDelimiter = start === 0 && !namedCsv ? lineDelimiter(raw) ?? delimiter : delimiter
    const cells = splitCsvLine(raw, rowDelimiter)
    const turkish = cells[turkishIdx] ?? cells[0] ?? ""
    const english = englishIdx >= 0 ? cells[englishIdx] : cells.length > 1 ? cells[1] : undefined
    const cleaned = cleanPair(turkish, english)
    if (!cleaned) continue
    const cefrSourceRaw = (cefrSourceIdx >= 0 ? cells[cefrSourceIdx] : "")?.toLowerCase() ?? ""
    const frequencyRank = frequencyIdx >= 0 ? Number(cells[frequencyIdx]) : NaN
    rows.push({
      turkish: cleaned.turkish,
      english: cleaned.english,
      partOfSpeech: parsePos(posIdx >= 0 ? cells[posIdx] : undefined) ?? guessPartOfSpeech(cleaned.turkish),
      cefrLevel: parseCefr(cefrIdx >= 0 ? cells[cefrIdx] : undefined),
      cefrSource:
        cefrSourceRaw === "verified" || cefrSourceRaw === "estimate" || cefrSourceRaw === "user"
          ? cefrSourceRaw
          : undefined,
      frequencyRank: Number.isFinite(frequencyRank) ? frequencyRank : undefined,
      collocations:
        collocationsIdx >= 0 && cells[collocationsIdx]
          ? cells[collocationsIdx].split(/[;|]/).map((item) => item.trim()).filter(Boolean)
          : undefined,
      tags: tagsIdx >= 0 && cells[tagsIdx] ? cells[tagsIdx].split(/[|,]/).map((t) => t.trim()).filter(Boolean) : undefined,
      lineNumber: i + 1,
    })
  }
  return rows
}

export function parseImport(text: string, filename?: string): ParsedImportRow[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const lower = filename?.toLowerCase() ?? ""
  if (lower.endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return parseJson(trimmed)
    } catch (error) {
      if (lower.endsWith(".json")) throw error
    }
  }

  return parseDelimited(trimmed, filename)
}

export function markFileDuplicates(rows: ParsedImportRow[]) {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const normalized = normalizeTurkish(row.turkish)
    const count = seen.get(normalized) ?? 0
    seen.set(normalized, count + 1)
    return { ...row, normalized, duplicateInFile: count > 0 }
  })
}

export function suggestedDictionaryForm(row: ParsedImportRow): string {
  return dictionaryFormGuess(row.turkish)
}
