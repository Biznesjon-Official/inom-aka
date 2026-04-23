import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import Sale from '@/models/Sale'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const body = await req.json()

    if (body.clearRemaining) {
      const debt = await Debt.findById(id)
      if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const writeOffAmount = debt.remainingAmount
      if (writeOffAmount > 0) {
        // Record as payment so reports include it
        const targetSaleId = debt.sale
        let salePayedBefore = 0
        if (targetSaleId) {
          const saleSnap = await Sale.findById(targetSaleId).select('paid').lean() as { paid: number } | null
          salePayedBefore = saleSnap?.paid || 0
          await Sale.findByIdAndUpdate(targetSaleId, { $inc: { paid: writeOffAmount } })
        }
        debt.payments.push({
          amount: writeOffAmount,
          method: 'cash',
          date: new Date(),
          note: body.note || 'Qarz yopildi',
          fromSale: false,
          saleRef: targetSaleId,
          salePayedBefore,
        })
        debt.paidAmount = Math.round((debt.paidAmount + writeOffAmount) * 100) / 100
      }

      debt.totalAmount = debt.paidAmount
      debt.remainingAmount = 0
      debt.status = 'paid'
      await debt.save()
      return NextResponse.json(debt)
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (err) { return errorResponse(err) }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { customerName, customerPhone } = await req.json()
    const debt = await Debt.findByIdAndUpdate(
      id,
      { customerName, customerPhone },
      { new: true }
    )
      .populate('category', 'name')
      .populate({ path: 'sale', select: 'total paid createdAt paymentType items receiptNo' })
      .populate({ path: 'entries.sale', select: 'items receiptNo', model: 'Sale' })
    if (!debt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(debt)
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
