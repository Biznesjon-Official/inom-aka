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

    // Note: Both admin and worker can return any sale
    // (removed worker restriction)

    let returnTotal = 0
    let returnCostTotal = 0
    const returnedItems: { product: string; productName: string; unit: string; qty: number; salePrice: number; costPrice: number }[] = []

    for (const returnItem of items) {
      const saleItem = sale.items.find(
        (si: { product: { toString: () => string }; qty: number; productName: string; unit: string; salePrice: number; costPrice: number }) =>
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
        unit: saleItem.unit,
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

        const R = effectiveReturnTotal
        const debtDecrease = Math.min(R, debt.remainingAmount)
        const overpaid = Math.round((R * 100 - debtDecrease * 100)) / 100

        // Refund overpaid amount to kassa (only when return > remaining debt)
        if (overpaid > 0) {
          await Sale.findByIdAndUpdate(id, {
            $inc: { paid: -overpaid },
            $push: { payments: { method: 'cash', amount: -overpaid, date: new Date() } },
          })
        }

        // Update debt amounts
        if (debt.status === 'active') {
          debt.totalAmount = Math.round(debt.totalAmount * 100 - R * 100) / 100
          debt.remainingAmount = Math.round(debt.remainingAmount * 100 - debtDecrease * 100) / 100
          if (overpaid > 0) {
            debt.paidAmount = Math.round(debt.paidAmount * 100 - overpaid * 100) / 100
            if (debt.paidAmount < 0) debt.paidAmount = 0
          }
          if (debt.remainingAmount <= 0.01) {
            debt.remainingAmount = 0
            debt.status = 'paid'
            debt.note = (debt.note || '') + ' [Sotuv qaytarildi]'
          }
        }

        // Update or remove this sale's entry (for display purposes)
        const entryTotal = entry?.amount || sale.total
        const newEntryTotal = Math.round(entryTotal * 100 - R * 100) / 100
        if (entry) {
          if (newEntryTotal > 0) {
            entry.amount = newEntryTotal
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
