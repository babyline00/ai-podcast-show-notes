import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Returns high-level counts for the dashboard / header. Keeps the query
 * surface minimal so it can be polled cheaply.
 */
export async function GET() {
  try {
    const episodes = await db.episode.count()
    const rows = await db.episode.findMany({
      select: { durationSec: true },
    })
    const totalDurationSec = rows.reduce(
      (sum, r) => sum + (r.durationSec ?? 0),
      0,
    )
    return NextResponse.json({ episodes, totalDurationSec })
  } catch (e) {
    console.error('[GET /api/stats]', e)
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    )
  }
}
