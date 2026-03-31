import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    if (body.clearRemaining) {
      const debt = await Debt.findById(id)
      if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      debt.totalAmount = debt.paidAmount
      debt.remainingAmount = 0
      debt.status = 'paid'
      await debt.save()
      return NextResponse.json(debt)
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await Debt.findByIdAndDelete(id)
    return NextResponse.json({ ok: true })
  } catch (err) { return errorResponse(err) }
}
