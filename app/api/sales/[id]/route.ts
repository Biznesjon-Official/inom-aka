import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { total, paid, paymentType } = await req.json()

    const sale = await Sale.findByIdAndUpdate(
      id,
      { total, paid, paymentType },
      { new: true }
    )

    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    return NextResponse.json(sale)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    await Sale.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) { return errorResponse(err) }
}
