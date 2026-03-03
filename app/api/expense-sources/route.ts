import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import ExpenseSource from '@/models/ExpenseSource'

export async function GET() {
  await connectDB()
  const sources = await ExpenseSource.find().sort({ name: 1 }).lean()
  return NextResponse.json(sources)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const source = await ExpenseSource.create(body)
  return NextResponse.json(source, { status: 201 })
}
