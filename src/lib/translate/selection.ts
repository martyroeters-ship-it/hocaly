const SKIP = "input, textarea, select, [contenteditable='true'], [data-no-translate]"
const MAX_CHARS = 160
const WORD_CHAR = /[\p{L}\p{M}'’\-]/u

function asElement(target: EventTarget | null): Element | null {
  if (!target || typeof target !== "object") return null
  if ("closest" in target && typeof (target as Element).closest === "function") return target as Element
  if ("parentElement" in target) return (target as Node).parentElement
  return null
}

export function selectedTextForTranslate(target: EventTarget | null, raw: string) {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text || text.length > MAX_CHARS) return null
  if (!/[\p{L}]/u.test(text)) return null
  const element = asElement(target)
  if (element?.closest(SKIP)) return null
  return text
}

export function hasTextSelection() {
  if (typeof window === "undefined") return false
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return false
  return Boolean(selection.toString().replace(/\s+/g, " ").trim())
}

export function wordFromTextOffset(text: string, offset: number) {
  if (!text) return null
  let index = Math.min(Math.max(offset, 0), text.length)
  if (
    index > 0 &&
    (index === text.length || !WORD_CHAR.test(text[index] ?? "")) &&
    WORD_CHAR.test(text[index - 1] ?? "")
  ) {
    index -= 1
  }
  if (!WORD_CHAR.test(text[index] ?? "")) return null
  let start = index
  let end = index + 1
  while (start > 0 && WORD_CHAR.test(text[start - 1]!)) start -= 1
  while (end < text.length && WORD_CHAR.test(text[end]!)) end += 1
  const word = text.slice(start, end).replace(/\s+/g, " ").trim()
  return word || null
}

function wordAtPoint(x: number, y: number) {
  if (typeof document === "undefined") return null
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y)
    node = range?.startContainer ?? null
    offset = range?.startOffset ?? 0
  } else if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y)
    node = pos?.offsetNode ?? null
    offset = pos?.offset ?? 0
  }
  if (!node) return null
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  if (element?.closest(SKIP)) return null
  if (node.nodeType !== Node.TEXT_NODE) return null
  return wordFromTextOffset(node.textContent ?? "", offset)
}

function singleTokenFromTarget(target: EventTarget | null) {
  const element = asElement(target)
  if (!element || element.closest(SKIP)) return null
  const text = (element.textContent ?? "").replace(/\s+/g, " ").trim()
  if (!text || text.includes(" ") || text.length > MAX_CHARS) return null
  if (!/^[\p{L}\p{M}'’\-]+$/u.test(text)) return null
  return text
}

export function textForTranslate(
  target: EventTarget | null,
  rawSelection: string,
  point?: { x: number; y: number },
) {
  const fromSelection = selectedTextForTranslate(target, rawSelection)
  if (fromSelection) return fromSelection
  const fromPoint = point ? wordAtPoint(point.x, point.y) : null
  const fromWord = selectedTextForTranslate(target, fromPoint ?? "")
  if (fromWord) return fromWord
  return selectedTextForTranslate(target, singleTokenFromTarget(target) ?? "")
}
