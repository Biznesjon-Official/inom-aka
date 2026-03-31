import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import Debt from '@/models/Debt'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    const { id } = await params
    const { items } = await req.json() as { items: { product: string; qty: number }[] }

    if (!items?.length) {
      return NextResponse.json({ error: 'Items required' }, { status: 400 })
    }

    const sale = await Sale.findById(id)
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // Worker can only return own sales
    if (session?.user?.role === 'worker' && sale.cashier.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Faqat o\'z sotuvlaringizni qaytara olasiz' }, { status: 403 })
    }

    let returnTotal = 0
    let returnCostTotal = 0
    const returnedItems: { product: string; productName: string; qty: number; salePrice: number; costPrice: number }[] = []

    for (const returnItem of items) {
      const saleItem = sale.items.find(
        (si: { product: { toString: () => string }; qty: number; productName: string; salePrice: number; costPrice: number }) =>
          si.product.toString() === returnItem.product
      )
      if (!saleItem) continue

      // Check already returned qty for this product
      const alreadyReturned = (sale.returnedItems || [])
        .filter((ri: { product: { toString: () => string } }) => ri.product.toString() === returnItem.product)
        .reduce((sum: number, ri: { qty: number }) => sum + ri.qty, 0)

      const maxReturnable = saleItem.qty - alreadyReturned
      const qty = Math.min(returnItem.qty, maxReturnable)
      if (qty <= 0) continue

      const amount = qty * saleItem.salePrice
      returnTotal += amount
      returnCostTotal += qty * (saleItem.costPrice || 0)

      returnedItems.push({
        product: returnItem.product,
        productName: saleItem.productName,
        qty,
        salePrice: saleItem.salePrice,
        costPrice: saleItem.costPrice || 0,
      })

      // Restore stock
      await Product.findByIdAndUpdate(returnItem.product, { $inc: { stock: qty } })
    }

    if (returnedItems.length === 0) {
      return NextResponse.json({ error: 'Nothing to return' }, { status: 400 })
    }

    // Apply discount ratio: returnedTotal stored at effective (discounted) price
    const originalItemsTotal = sale.items.reduce(
      (s: number, i: { qty: number; salePrice: number }) => s + i.qty * i.salePrice, 0
    )
    const discountRatio = originalItemsTotal > 0 ? sale.total / originalItemsTotal : 1
    const effectiveReturnTotal = Math.round(returnTotal * discountRatio)
    const effectiveCostTotal = returnCostTotal // cost is actual, not discounted

    // Update sale
    await Sale.findByIdAndUpdate(id, {
      $push: { returnedItems: { $each: returnedItems } },
      $inc: { returnedTotal: effectiveReturnTotal, returnedCostTotal: effectiveCostTotal },
    })

    // If sale had debt, adjust debt accordingly
    if (sale.paymentType === 'partial' || sale.paymentType === 'debt') {
      const debt = sale.debt
        ? await Debt.findById(sale.debt)
        : await Debt.findOne({ sale: sale._id })
      if (debt) {
        // Find this sale's entry to determine its debt portion
        const saleEntry = debt.entries.find(
          (e: { sale?: { toString: () => string } }) => e.sale?.toString() === sale._id.toString()
        )
        // Fallback for old entries without sale ref: use receipt number from note
        const saleEntryFallback = !saleEntry ? debt.entries.find(
          (e: { note?: string }) => e.note?.includes(`#${sale.receiptNo}`)
        ) : null
        const entry = saleEntry || saleEntryFallback

        // T = current entry total, P = total paid (upfront + debt payments), R = return amount
        const entryTotal = entry?.amount || sale.total
        const entryPaid = entry?.paidAmount ?? (sale.paymentType === 'debt' ? 0 : sale.paid)
        const R = effectiveReturnTotal
        const newEntryTotal = Math.round(entryTotal * 100 - R * 100) / 100
        const newRemaining = Math.max(0, Math.round(newEntryTotal * 100 - entryPaid * 100) / 100)
        const saleDebtPortion = Math.round(entryTotal * 100 - entryPaid * 100) / 100
        const debtReduction = Math.round(saleDebtPortion * 100 - newRemaining * 100) / 100
        const overpaid = Math.max(0, Math.round(entryPaid * 100 - newEntryTotal * 100) / 100)

        // Find refundable debt payments for this sale
        const salePayments = debt.payments.filter(
          (p: { fromSale?: boolean; refunded?: boolean; saleRef?: { toString: () => string } }) =>
            !p.fromSale && !p.refunded && p.saleRef?.toString() === sale._id.toString()
        )
        const isSingleSaleDebt = debt.entries.length <= 1
        const refundablePmts = salePayments.length > 0 ? salePayments
          : isSingleSaleDebt ? debt.payments.filter(
              (p: { fromSale?: boolean; refunded?: boolean }) => !p.fromSale && !p.refunded
            ) : []

        // Mark only enough payments as refunded to cover overpaid amount
        let refundRemaining = overpaid
        for (const rp of refundablePmts) {
          if (refundRemaining <= 0) break
          rp.refunded = true
          refundRemaining = Math.round(refundRemaining * 100 - rp.amount * 100) / 100
        }

        // Refund overpaid amount to kassa (reduce Sale.paid + track in payments)
        if (overpaid > 0) {
          await Sale.findByIdAndUpdate(id, {
            $inc: { paid: -overpaid },
            $push: { payments: { method: 'cash', amount: -overpaid, date: new Date() } },
          })
        }

        // Update debt amounts
        if (debt.status === 'active') {
          if (debtReduction > 0) {
            debt.remainingAmount = Math.round(debt.remainingAmount * 100 - debtReduction * 100) / 100
          }
          debt.totalAmount = Math.round(debt.totalAmount * 100 - R * 100) / 100
          debt.paidAmount = Math.round(debt.paidAmount * 100 - overpaid * 100) / 100
          if (debt.paidAmount < 0) debt.paidAmount = 0
          if (debt.remainingAmount <= 0.01) {
            debt.remainingAmount = 0
          }
          if (debt.remainingAmount <= 0) {
            debt.status = 'paid'
            debt.note = (debt.note || '') + ' [Sotuv qaytarildi]'
          }
        }

        // Update or remove this sale's entry
        if (entry) {
          if (newEntryTotal > 0) {
            entry.amount = newEntryTotal
            entry.paidAmount = Math.min(entryPaid, newEntryTotal)
          } else {
            debt.entries = debt.entries.filter(
              (e: { sale?: { toString: () => string }; note?: string }) =>
                e !== entry
            )
          }
        }

        await debt.save()
      }
    }

    return NextResponse.json({ returnedItems, returnTotal: effectiveReturnTotal }, { status: 200 })
  } catch (err) { return errorResponse(err) }
}
