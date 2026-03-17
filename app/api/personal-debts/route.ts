import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import PersonalDebt from '@/models/PersonalDebt'
import { escapeRegex } from '@/lib/utils'

export async function GET(req: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i')
      filter.$or = [{ name: regex }, { phone: regex }]
    }

    const debts = await PersonalDebt.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    return NextResponse.json(debts)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const { name, phone, direction, amount, note } = await req.json()

    if (!name?.trim() || !amount || amount <= 0) {
      return NextResponse.json({ error: 'name and amount required' }, { status: 400 })
    }
    if (!['receivable', 'payable'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }

    const debt = await PersonalDebt.create({
      name: name.trim(),
      phone: phone?.trim() || undefined,
      direction,
      totalAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      note: note || undefined,
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
