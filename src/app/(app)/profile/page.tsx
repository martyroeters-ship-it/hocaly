import { ProfileView } from "@/components/profile/profile-view"
import { ensureDb } from "@/lib/prisma"
import { getProfileCefr } from "@/lib/profile"

export default async function ProfilePage() {
  await ensureDb()
  const cefr = await getProfileCefr()
  return <ProfileView initialCefr={cefr} />
}
