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

    const payout = await CashbackPayout.findByIdAndUpdate(
      id,
      { amount, totalSales, percent, note },
      { new: true }
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
