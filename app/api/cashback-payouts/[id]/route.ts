import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import CashbackPayout from '@/models/CashbackPayout'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()
    const { amount, totalSales, percent, note } = body

    // Reject negative / non-numeric values
    for (const [k, v] of Object.entries({ amount, totalSales, percent })) {
      if (v !== undefined && v !== null && v !== '' && (isNaN(Number(v)) || Number(v) < 0)) {
        return NextResponse.json({ error: `${k} manfiy bo'lmagan raqam bo'lishi kerak` }, { status: 400 })
      }
    }
    if (percent !== undefined && Number(percent) > 100) {
      return NextResponse.json({ error: 'percent 0-100 oralig\'ida bo\'lishi kerak' }, { status: 400 })
    }

    const payout = await CashbackPayout.findByIdAndUpdate(
      id,
      { amount, totalSales, percent, note },
      { returnDocument: 'after' }
    )

    if (!payout) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

    return NextResponse.json(payout)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await CashbackPayout.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) { return errorResponse(err) }
}
