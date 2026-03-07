import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import ExpenseSource from '@/models/ExpenseSource'

export async function GET() {
  try {
    await connectDB()
    const sources = await ExpenseSource.find().sort({ name: 1 }).lean()
    return NextResponse.json(sources)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    const source = await ExpenseSource.create(body)
    return NextResponse.json(source, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
