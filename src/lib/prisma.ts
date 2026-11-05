import path from "node:path"
import { PrismaClient } from "@prisma/client"

const dbUrl = `file:${path.join(process.cwd(), "prisma", "dev.db")}`

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaStamp?: string }
const PRISMA_STAMP = "grammar-diagnostic-day-sql-v2"
if (globalForPrisma.prismaStamp !== PRISMA_STAMP) {
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaStamp = PRISMA_STAMP
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

let ready: Promise<void> | null = null

async function initDb() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  })
  await prisma.grammarProfile.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      knownJson: JSON.stringify([
        "personal-pronouns",
        "present-continuous",
        "simple-past",
        "plural",
        "locative",
        "dative",
        "var-yok",
      ]),
    },
  })
  // Optional model: skip if client was generated before GrammarSettings existed.
  if (typeof prisma.grammarSettings?.upsert === "function") {
    await prisma.grammarSettings.upsert({
      where: { id: "default" },
      update: {},
      create: {
        id: "default",
        intervalsJson: "[1,2,3,7,14,30]",
      },
    })
  } else {
    console.warn(
      "[prisma] grammarSettings missing on client — run `npx prisma generate` and restart the server",
    )
  }
}

export function ensureDb() {
  if (!ready) {
    ready = initDb().catch((error) => {
      ready = null
      throw error
    })
  }
  return ready
}
