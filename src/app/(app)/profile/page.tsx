import { Suspense } from "react"
import { connection } from "next/server"
import { ProfileView } from "@/components/profile/profile-view"
import { PageBody, PageHero } from "@/components/layout/page-hero"
import { ensureDb } from "@/lib/prisma"
import { getProfileCefr } from "@/lib/profile"

async function ProfileContent() {
  // Defer DB access to request time so `next build` does not require a migrated Settings table.
  await connection()
  await ensureDb()
  const cefr = await getProfileCefr()
  return <ProfileView initialCefr={cefr} />
}

function ProfileFallback() {
  return (
    <div>
      <PageHero
        title="Profile"
        subtitle="Local single-user settings. Generated examples, stories, and practice follow this Turkish CEFR unless an exercise lets you pick another level for that session."
      />
      <PageBody narrow>
        <p className="text-muted-foreground">Loading profile…</p>
      </PageBody>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileFallback />}>
      <ProfileContent />
    </Suspense>
  )
}
