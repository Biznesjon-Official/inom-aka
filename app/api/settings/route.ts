import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Settings from '@/models/Settings'

export async function GET() {
  try {
    await connectDB()
    const docs = await Settings.find().lean()
    const result: Record<string, unknown> = {}
    for (const doc of docs) {
      result[doc.key] = doc.value
    }
    return NextResponse.json(result)
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(req: Request) {
  try {
    await connectDB()
    const { key, value } = await req.json()
    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }
    await Settings.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
