import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import PersonalDebt from '@/models/PersonalDebt'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { amount, note } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const debt = await PersonalDebt.findById(id)
    if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (amount > debt.remainingAmount) {
      return NextResponse.json({ error: 'Amount exceeds remaining debt' }, { status: 400 })
    }

    debt.payments.push({ amount, date: new Date(), note })
    debt.paidAmount = Math.round(debt.paidAmount * 100 + amount * 100) / 100
    debt.remainingAmount = Math.round(debt.remainingAmount * 100 - amount * 100) / 100
    if (debt.remainingAmount <= 0.01) {
      debt.remainingAmount = 0
      debt.status = 'paid'
    }
    await debt.save()

    return NextResponse.json(debt)
  } catch (err) { return errorResponse(err) }
}
