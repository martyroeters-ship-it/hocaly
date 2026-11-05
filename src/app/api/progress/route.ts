import { fail, ok } from "@/lib/api"
import { ensureDb } from "@/lib/prisma"
import { dashboardStats } from "@/lib/repos/stats"

export async function GET() {
  try {
    await ensureDb()
    return ok(await dashboardStats())
  } catch (error) {
    return fail(error)
  }
}
