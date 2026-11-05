"use client"

import { useEffect, useState } from "react"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/client"

type Stats = {
  total: number
  newWords: number
  learning: number
  reviewing: number
  mastered: number
  due: number
  streak: number
  accuracy: number | null
  wordsThisWeek: number
  studySeconds: number
  cefrCoverage: { level: string; target: number; known: number; ratio: number }[]
  heatmap: { date: string; reviewsDone: number; newLearned: number }[]
  tokenUsage: { input: number; output: number; estimatedUsd: number }
  speechUsage?: { units: number; estimatedUsd: number }
  skills?: { skill: string; attempts: number; due: number; accuracy: number | null }[]
}

export function ProgressView() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api<Stats>("/api/progress").then(setStats)
  }, [])

  if (!stats) {
    return (
      <div>
        <PageHero
          title="Progress"
          subtitle="Counts show study activity. They do not by themselves establish CEFR proficiency."
        />
        <PageBody>
          <p className="text-muted-foreground">Loading progress…</p>
        </PageBody>
      </div>
    )
  }

  const tiles = [
    ["Imported", stats.total],
    ["New", stats.newWords],
    ["Learning", stats.learning],
    ["Mastered", stats.mastered],
    ["Due", stats.due],
    ["Streak", stats.streak],
    ["This week", stats.wordsThisWeek],
    ["Study time", `${Math.round(stats.studySeconds / 60)} min`],
  ] as const

  return (
    <div>
      <PageHero
        title="Progress"
        subtitle="Counts show study activity. They do not by themselves establish CEFR proficiency."
      />
      <PageBody className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <Card key={label}>
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle>{value}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Each square is a study day.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[repeat(21,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(28,minmax(0,1fr))]">
              {Array.from({ length: 84 }).map((_, i) => {
                const date = new Date()
                date.setDate(date.getDate() - (83 - i))
                const key = date.toISOString().slice(0, 10)
                const day = stats.heatmap.find((item) => item.date === key)
                const intensity = Math.min(1, ((day?.reviewsDone ?? 0) + (day?.newLearned ?? 0)) / 12)
                return (
                  <div
                    key={key}
                    title={key}
                    className="size-3 rounded-sm"
                    style={{ background: `color-mix(in oklab, var(--primary) ${Math.round(intensity * 100)}%, var(--muted))` }}
                  />
                )
              })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
            <CardDescription>Reading, writing, listening, and speaking are tracked separately.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {(stats.skills ?? []).map((skill) => (
              <div key={skill.skill} className="rounded-lg bg-muted/50 p-3">
                <div className="font-medium capitalize">{skill.skill}</div>
                <p className="text-sm text-muted-foreground">
                  {skill.attempts} attempts · {skill.due} due · {skill.accuracy == null ? "—" : `${skill.accuracy}%`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Estimated API cost</CardTitle>
            <CardDescription>
              {stats.tokenUsage.input + stats.tokenUsage.output} tokens · ${stats.tokenUsage.estimatedUsd.toFixed(4)}
              {stats.speechUsage ? ` · speech $${stats.speechUsage.estimatedUsd.toFixed(4)}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      </PageBody>
    </div>
  )
}
