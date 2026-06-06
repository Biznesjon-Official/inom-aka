import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'
import Sale from '@/models/Sale'
import mongoose, { Types } from 'mongoose'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    const collectedBy = (session?.user as { id?: string } | undefined)?.id
    const { id } = await params
    const { amount, note, method } = await req.json()

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Summa musbat bo\'lishi kerak' }, { status: 400 })
    }

    const debt0 = await Debt.findById(id)
    if (!debt0) return NextResponse.json({ error: 'Qarz topilmadi' }, { status: 404 })
    if (amount > debt0.remainingAmount + 0.01) {
      return NextResponse.json({ error: 'To\'lov summasi qolgan qarzdan ko\'p' }, { status: 400 })
    }

    const validMethod = ['cash', 'card', 'terminal'].includes(method) ? method : 'cash'
    const collectedByOid = collectedBy ? new Types.ObjectId(collectedBy) : undefined

    // Per-sale allocations (used after commit for cashback)
    const saleAllocations = new Map<string, number>()
    let targetSaleId: Types.ObjectId | undefined

    // Atomic: debt update + Sale.paid sync committed together (sequential ops — one session)
    const dbSession = await mongoose.startSession()
    try {
      await dbSession.withTransaction(async () => {
        const debt = await Debt.findById(id).session(dbSession)
        if (!debt) throw Object.assign(new Error('Qarz topilmadi'), { statusCode: 404 })

        saleAllocations.clear()
        targetSaleId = debt.sale

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

        if (saleAllocations.size > 0) {
          const allocEntries = [...saleAllocations]
          for (const [saleId, allocated] of allocEntries) {
            const snap = await Sale.findById(saleId).select('paid').session(dbSession).lean() as { paid: number } | null
            debt.payments.push({
              amount: allocated, method: validMethod, date: new Date(), note,
              saleRef: new Types.ObjectId(saleId), salePayedBefore: snap?.paid || 0, collectedBy: collectedByOid,
            })
          }
          // Portion to non-sale entries (or unallocated) so payments[] = full amount
          const allocatedTotal = allocEntries.reduce((s, [, a]) => s + a, 0)
          const leftover = Math.round((amount - allocatedTotal) * 100) / 100
          if (leftover > 0.01) {
            debt.payments.push({ amount: leftover, method: validMethod, date: new Date(), note, collectedBy: collectedByOid })
          }
        } else {
          let salePayedBefore = 0
          if (targetSaleId) {
            const saleSnap = await Sale.findById(targetSaleId).select('paid').session(dbSession).lean() as { paid: number } | null
            salePayedBefore = saleSnap?.paid || 0
          }
          debt.payments.push({ amount, method: validMethod, date: new Date(), note, saleRef: targetSaleId, salePayedBefore, collectedBy: collectedByOid })
        }

        debt.paidAmount = Math.round((debt.paidAmount || 0) * 100 + amount * 100) / 100
        debt.remainingAmount = Math.round(debt.remainingAmount * 100 - amount * 100) / 100
        if (debt.remainingAmount < 0.01) {
          debt.remainingAmount = 0
          debt.status = 'paid'
        }
        await debt.save({ session: dbSession })

        // Sync Sale.paid / Sale.payments (sequential within the transaction)
        if (saleAllocations.size > 0) {
          for (const [saleId, allocated] of saleAllocations) {
            await Sale.findByIdAndUpdate(saleId, {
              $inc: { paid: allocated },
              $push: { payments: { method: validMethod, amount: allocated, date: new Date() } },
            }, { session: dbSession })
          }
        } else if (targetSaleId) {
          await Sale.findByIdAndUpdate(targetSaleId, {
            $inc: { paid: amount },
            $push: { payments: { method: validMethod, amount, date: new Date() } },
          }, { session: dbSession })
        }
      })
    } finally {
      await dbSession.endSession()
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

    return NextResponse.json(await Debt.findById(id))
  } catch (err) {
    const e = err as { statusCode?: number; message?: string }
    if (e?.statusCode) return NextResponse.json({ error: e.message }, { status: e.statusCode })
    return errorResponse(err)
  }
}
