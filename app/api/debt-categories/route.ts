import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import DebtCategory from '@/models/DebtCategory'

export async function GET() {
  try {
    await connectDB()
    const categories = await DebtCategory.find().sort({ name: 1 }).lean()
    return NextResponse.json(categories)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const cat = await DebtCategory.create({ name: body.name.trim(), description: body.description?.trim() || undefined })
    return NextResponse.json(cat, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
