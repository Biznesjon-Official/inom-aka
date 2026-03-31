import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Expense from '@/models/Expense'

export async function GET(req: Request) {
  try {
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
      .limit(200)
      .lean()

    return NextResponse.json(expenses)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body.source) return NextResponse.json({ error: 'Source required' }, { status: 400 })
    if (typeof body.amount !== 'number' || body.amount <= 0) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    const expense = await Expense.create({ source: body.source, amount: body.amount, description: body.description, date: body.date })
    const populated = await expense.populate('source', 'name')
    return NextResponse.json(populated, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
