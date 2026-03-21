import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import PersonalDebt from '@/models/PersonalDebt'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { amount } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const debt = await PersonalDebt.findById(id)
    if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    debt.totalAmount = Math.round((debt.totalAmount + amount) * 100) / 100
    debt.remainingAmount = Math.round((debt.remainingAmount + amount) * 100) / 100
    if (debt.status === 'paid' && debt.remainingAmount > 0) {
      debt.status = 'active'
    }
    
    await debt.save()

    return NextResponse.json(debt)
  } catch (err) { return errorResponse(err) }
}
