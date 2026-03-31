import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import Debt from '@/models/Debt'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { total, paid, paymentType } = await req.json()

    if (typeof total === 'number' && total <= 0) return NextResponse.json({ error: 'Total must be positive' }, { status: 400 })
    if (typeof paid === 'number' && typeof total === 'number' && paid > total) return NextResponse.json({ error: 'Paid cannot exceed total' }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (total !== undefined) update.total = total
    if (paid !== undefined) update.paid = paid
    if (paymentType !== undefined) update.paymentType = paymentType

    const sale = await Sale.findByIdAndUpdate(id, update, { new: true })

    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    return NextResponse.json(sale)
  } catch (err) { return errorResponse(err) }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const sale = await Sale.findById(id)
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    // Restore stock (original qty minus already returned)
    for (const item of sale.items) {
      const alreadyReturned = (sale.returnedItems || [])
        .filter((ri: { product: { toString: () => string } }) => ri.product.toString() === item.product.toString())
        .reduce((sum: number, ri: { qty: number }) => sum + ri.qty, 0)
      const restoreQty = item.qty - alreadyReturned
      if (restoreQty > 0) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: restoreQty } })
      }
    }

    // Clean up debt if sale had one
    if (sale.debt) {
      const debt = await Debt.findById(sale.debt)
      if (debt) {
        const entry = debt.entries.find(
          (e: { sale?: { toString: () => string } }) => e.sale?.toString() === sale._id.toString()
        )
        if (entry) {
          const entryDebt = (entry.amount || 0) - (entry.paidAmount || 0)
          debt.totalAmount = Math.round(debt.totalAmount * 100 - (entry.amount || 0) * 100) / 100
          debt.paidAmount = Math.round(debt.paidAmount * 100 - (entry.paidAmount || 0) * 100) / 100
          debt.remainingAmount = Math.round(debt.remainingAmount * 100 - entryDebt * 100) / 100
          if (debt.paidAmount < 0) debt.paidAmount = 0
          if (debt.remainingAmount < 0) debt.remainingAmount = 0
          debt.entries = debt.entries.filter(
            (e: { sale?: { toString: () => string } }) => e.sale?.toString() !== sale._id.toString()
          )
          // Mark related payments as refunded
          for (const p of debt.payments) {
            if (p.saleRef?.toString() === sale._id.toString()) p.refunded = true
          }
          if (debt.entries.length === 0 || debt.remainingAmount <= 0) {
            debt.status = 'paid'
          }
          await debt.save()
        }
      }
    }

    await Sale.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch (err) { return errorResponse(err) }
}
