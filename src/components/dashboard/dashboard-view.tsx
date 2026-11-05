"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/client"

type Stats = {
  total: number
  due: number
  overdue?: number
  newWords: number
  estimatedRetention?: number | null
  recognition?: { accuracy: number | null }
  production?: { accuracy: number | null }
}

type GrammarTip = { structureId: string; label: string; cefr: string; tip: string }
type GrammarProgress = { knownCount: number; total: number; focus: { id: string; label: string; accuracy: number | null }[] }

export function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tips, setTips] = useState<GrammarTip[]>([])
  const [grammar, setGrammar] = useState<GrammarProgress | null>(null)

  useEffect(() => {
    api<Stats>("/api/progress").then(setStats).catch(() => setStats(null))
    api<{ tips: GrammarTip[] }>("/api/grammar?view=tips").then((data) => setTips(data.tips)).catch(() => setTips([]))
    api<GrammarProgress>("/api/grammar?view=progress").then(setGrammar).catch(() => setGrammar(null))
  }, [])

  return (
    <div>
      <PageHero
        overlap
        eyebrow="Welcome back"
        title="Grammar + vocabulary"
        subtitle="Learn forms in context, drill verbs deliberately, and pull words from the videos you watch."
      />

      <PageBody className="space-y-6 pt-0">
        <div className="-mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/grammar", title: "Practice grammar", text: "Level browse, form drills, sentence context" },
            { href: "/vocabulary", title: "Vocabulary library", text: "Words by CEFR level + contextual practice" },
            { href: "/transcripts", title: "Video transcripts", text: "Upload a transcript → test words in sentences" },
            { href: "/dialogue", title: "Dialogue", text: "Keep speaking with role-play conversations" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)] ring-1 ring-black/8 transition-colors hover:bg-accent"
            >
              <div className="text-lg font-semibold">{item.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-none ring-1 ring-black/8">
            <CardHeader>
              <CardTitle>Grammar today</CardTitle>
              <CardDescription>
                {grammar ? `${grammar.knownCount}/${grammar.total} structures looking solid` : "Loading…"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tips.length === 0 ? (
                <p className="text-sm text-muted-foreground">Run a grammar test to get focus tips.</p>
              ) : (
                tips.slice(0, 3).map((tip) => (
                  <div key={tip.structureId} className="rounded-xl bg-muted/60 p-3">
                    <p className="font-medium">
                      {tip.label} <span className="text-sm text-muted-foreground">· {tip.cefr}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{tip.tip}</p>
                  </div>
                ))
              )}
              <Button nativeButton={false} render={<Link href="/grammar" />}>
                Open grammar
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-none ring-1 ring-black/8">
            <CardHeader>
              <CardTitle>Vocabulary today</CardTitle>
              <CardDescription>New words + spaced review, always with context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-sm text-muted-foreground">Due reviews</p>
                  <p className="text-2xl font-semibold">{stats?.due ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-sm text-muted-foreground">Library size</p>
                  <p className="text-2xl font-semibold">{stats?.total ?? "—"}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Recognition {stats?.recognition?.accuracy != null ? `${stats.recognition.accuracy}%` : "—"} · Production{" "}
                {stats?.production?.accuracy != null ? `${stats.production.accuracy}%` : "—"}
                {stats?.estimatedRetention != null ? ` · Est. retention ${stats.estimatedRetention}%` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href="/vocabulary?practice=daily" />}>
                  Daily words
                </Button>
                <Button nativeButton={false} variant="outline" render={<Link href="/vocabulary?practice=context" />}>
                  Meaning in context
                </Button>
                <Button nativeButton={false} variant="outline" render={<Link href="/vocabulary?practice=en-tr" />}>
                  English → Turkish
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </div>
  )
}
