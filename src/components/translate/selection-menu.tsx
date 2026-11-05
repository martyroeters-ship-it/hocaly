"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/client"
import { textForTranslate } from "@/lib/translate/selection"

type Translation = {
  turkish: string
  english: string
  dictionaryForm?: string
  partOfSpeech?: string
  note?: string
  fromLibrary?: boolean
}

type MenuState = {
  text: string
  x: number
  y: number
  result: Translation | null
  error: string | null
  busy: boolean
}

export function SelectionTranslateMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [mounted, setMounted] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef(0)
  const savedSelectionRef = useRef("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function translateAt(event: MouseEvent, raw: string) {
      const text = textForTranslate(event.target, raw, { x: event.clientX, y: event.clientY })
      if (!text) return false
      event.preventDefault()
      const request = requestRef.current + 1
      requestRef.current = request
      setMenu({ text, x: event.clientX, y: event.clientY + 8, result: null, error: null, busy: true })
      api<Translation>("/api/ai", {
        method: "POST",
        body: JSON.stringify({ action: "translate-selection", text }),
      })
        .then((data) => {
          if (requestRef.current !== request) return
          setMenu((current) => (current && current.text === text ? { ...current, result: data, busy: false } : current))
        })
        .catch((err) => {
          if (requestRef.current !== request) return
          const message = err instanceof Error ? err.message : "Could not translate"
          setMenu((current) => (current && current.text === text ? { ...current, error: message, busy: false } : current))
        })
      return true
    }

    function onContextMenu(event: MouseEvent) {
      const live = window.getSelection()?.toString() ?? ""
      const raw = live.trim() ? live : savedSelectionRef.current
      translateAt(event, raw)
      savedSelectionRef.current = ""
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(null)
    }

    function onPointerDown(event: MouseEvent) {
      if (event.button === 2) {
        savedSelectionRef.current = window.getSelection()?.toString() ?? ""
        return
      }
      if (boxRef.current?.contains(event.target as Node)) return
      setMenu(null)
    }

    window.addEventListener("contextmenu", onContextMenu, true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onPointerDown, true)
    return () => {
      window.removeEventListener("contextmenu", onContextMenu, true)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onPointerDown, true)
    }
  }, [])

  useEffect(() => {
    const box = boxRef.current
    if (!menu || !box) return
    const rect = box.getBoundingClientRect()
    const pad = 8
    const x = Math.min(Math.max(pad, menu.x), window.innerWidth - rect.width - pad)
    const y = Math.min(Math.max(pad, menu.y), window.innerHeight - rect.height - pad)
    if (Math.abs(x - menu.x) > 1 || Math.abs(y - menu.y) > 1) {
      setMenu((current) => (current ? { ...current, x, y } : current))
    }
  }, [menu])

  async function addToLibrary() {
    if (!menu?.result) return
    try {
      await api("/api/words", {
        method: "POST",
        body: JSON.stringify({
          turkish: menu.result.dictionaryForm || menu.text,
          english: menu.result.english,
          partOfSpeech: menu.result.partOfSpeech,
        }),
      })
      toast.success("Added to library")
      setMenu(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save")
    }
  }

  if (!mounted || !menu) return null

  return createPortal(
    <div
      ref={boxRef}
      data-no-translate
      role="dialog"
      aria-label="Translate selection"
      className="fixed z-[100] w-72 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      style={{ left: menu.x, top: menu.y }}
    >
      <p className="font-serif text-base leading-snug">{menu.text}</p>
      {menu.busy && <p className="mt-2 text-muted-foreground">Translating…</p>}
      {menu.error && <p className="mt-2 text-destructive">{menu.error}</p>}
      {menu.result && (
        <div className="mt-2 space-y-1">
          <p>{menu.result.english}</p>
          {menu.result.note && <p className="text-xs text-muted-foreground">{menu.result.note}</p>}
          {menu.result.partOfSpeech && (
            <p className="text-xs text-muted-foreground">
              {menu.result.partOfSpeech}
              {menu.result.dictionaryForm && menu.result.dictionaryForm !== menu.text
                ? ` · ${menu.result.dictionaryForm}`
                : ""}
            </p>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {menu.result && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void navigator.clipboard.writeText(menu.result!.english)}
            >
              Copy
            </Button>
            <Button size="sm" onClick={() => void addToLibrary()}>
              Add to library
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => setMenu(null)}>
          Close
        </Button>
      </div>
    </div>,
    document.body,
  )
}
