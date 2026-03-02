import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Expense from '@/models/Expense'

export async function GET(req: Request) {
  await connectDB()
  const { searchParams } = new URL(req.url)
  const source = searchParams.get('source')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const filter: Record<string, unknown> = {}
  if (source) filter.source = source
  if (from || to) {
    filter.date = {}
    if (from) (filter.date as Record<string, unknown>).$gte = new Date(from)
    if (to) (filter.date as Record<string, unknown>).$lte = new Date(to)
  }

  const expenses = await Expense.find(filter)
    .populate('source', 'name')
    .sort({ date: -1 })

  return NextResponse.json(expenses)
}

export async function POST(req: Request) {
  await connectDB()
  const body = await req.json()
  const expense = await Expense.create(body)
  const populated = await expense.populate('source', 'name')
  return NextResponse.json(populated, { status: 201 })
}
