import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import Sale from '@/models/Sale'
import { Types } from 'mongoose'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { amount, note, method } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Summa musbat bo\'lishi kerak' }, { status: 400 })
    }

    const debt = await Debt.findById(id)
    if (!debt) return NextResponse.json({ error: 'Qarz topilmadi' }, { status: 404 })

    if (amount > debt.remainingAmount + 0.01) {
      return NextResponse.json({ error: 'To\'lov summasi qolgan qarzdan ko\'p' }, { status: 400 })
    }

    const validMethod = ['cash', 'card', 'terminal'].includes(method) ? method : 'cash'

    // Distribute payment across entries in order (oldest first)
    // Track per-sale allocations to sync Sale.paid correctly
    const saleAllocations = new Map<string, number>()
    let targetSaleId = debt.sale
    
    if (debt.entries?.length > 0) {
      let remaining = amount
      for (const entry of debt.entries) {
        if (remaining <= 0.01) break
        const entryRemaining = Math.max(0, (entry.amount || 0) - (entry.paidAmount || 0))
        if (entryRemaining > 0.01) {
          const allocated = Math.min(remaining, entryRemaining)
          entry.paidAmount = Math.round((entry.paidAmount || 0) * 100 + allocated * 100) / 100
          remaining = Math.round(remaining * 100 - allocated * 100) / 100
          if (entry.sale) {
            const saleKey = entry.sale.toString()
            saleAllocations.set(saleKey, (saleAllocations.get(saleKey) || 0) + allocated)
            if (!targetSaleId) targetSaleId = entry.sale
          }
        }
      }
    }

    debt.payments.push({ amount, method: validMethod, date: new Date(), note, saleRef: targetSaleId })
    debt.paidAmount = Math.round((debt.paidAmount || 0) * 100 + amount * 100) / 100
    debt.remainingAmount = Math.round(debt.remainingAmount * 100 - amount * 100) / 100
    
    // Handle floating point precision
    if (debt.remainingAmount < 0.01) {
      debt.remainingAmount = 0
      debt.status = 'paid'
    }
    
    await debt.save()

    // Sync Sale.paid and Sale.payments for each sale that received payment
    if (saleAllocations.size > 0) {
      for (const [saleId, allocated] of saleAllocations) {
        const sale = await Sale.findByIdAndUpdate(saleId, {
          $inc: { paid: allocated },
          $push: { payments: { method: validMethod, amount: allocated, date: new Date() } },
        })
        if (!sale) {
          console.warn(`Sale ${saleId} not found when updating payment`)
        }
      }
    } else if (targetSaleId) {
      const sale = await Sale.findByIdAndUpdate(targetSaleId, {
        $inc: { paid: amount },
        $push: { payments: { method: validMethod, amount, date: new Date() } },
      })
      if (!sale) {
        console.warn(`Sale ${targetSaleId} not found when updating payment`)
      }
    }

    // Auto-record cashback for usta if the sale is linked to one
    const saleForCashback = targetSaleId
      ? await Sale.findById(targetSaleId).select('usta').lean() as { usta?: Types.ObjectId } | null
      : null
    if (saleForCashback?.usta) {
      const Customer = (await import('@/models/Customer')).default
      const CashbackPayout = (await import('@/models/CashbackPayout')).default
      const ustaId = saleForCashback.usta
      const usta = await Customer.findById(ustaId).select('cashbackPercent cashbackEndDate').lean() as { cashbackPercent?: number; cashbackEndDate?: Date } | null
      if (usta?.cashbackPercent && usta.cashbackPercent > 0) {
        // Use last archive's periodTo as periodFrom so alreadyPaid filter works correctly
        const lastArchive = await CashbackPayout.findOne({ customer: ustaId, type: 'archive' }).sort({ periodTo: -1 }).lean() as { periodTo: Date } | null
        const periodFrom = lastArchive?.periodTo ? new Date(lastArchive.periodTo) : new Date('2000-01-01')
        const now = new Date()
        const periodTo = usta.cashbackEndDate ? new Date(usta.cashbackEndDate) : now

        // Calculate current remaining to avoid double-pay (manual + auto)
        const salesAgg = await Sale.aggregate([
          { $match: { $or: [{ customer: ustaId }, { usta: ustaId }], createdAt: { $gt: periodFrom, $lte: periodTo } } },
          { $group: { _id: null, totalSales: { $sum: { $max: [0, { $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] }] } } } },
        ]).allowDiskUse(true)
        const totalSalesInPeriod = salesAgg[0]?.totalSales || 0
        const calculatedTotal = Math.round(totalSalesInPeriod * usta.cashbackPercent / 100)

        const existingAgg = await CashbackPayout.aggregate([
          { $match: { customer: ustaId, periodFrom: { $gte: periodFrom }, periodTo: { $lte: periodTo }, type: { $ne: 'archive' } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        const alreadyGiven = existingAgg[0]?.total || 0
        const canGive = Math.max(0, calculatedTotal - alreadyGiven)
        const cashbackAmount = Math.min(Math.round(amount * usta.cashbackPercent / 100), canGive)

        if (cashbackAmount > 0) {
          await CashbackPayout.create({
            customer: ustaId,
            amount: cashbackAmount,
            periodFrom,
            periodTo,
            totalSales: amount,
            percent: usta.cashbackPercent,
            type: 'money',
            note: `Qarz to'lovidan avtomatik${note ? ` (${note})` : ''}`,
          })
        }
      }
    }

    return NextResponse.json(debt)
  } catch (err) { return errorResponse(err) }
}
