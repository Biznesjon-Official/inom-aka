import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import Debt from '@/models/Debt'
import Customer from '@/models/Customer'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB()
    const { id } = await params
    const { items } = await req.json() as { items: { product: string; qty: number }[] }

    if (!items?.length) {
      return NextResponse.json({ error: 'Items required' }, { status: 400 })
    }

    const sale = await Sale.findById(id)
    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    let returnTotal = 0
    const returnedItems: { product: string; productName: string; qty: number; salePrice: number }[] = []

    for (const returnItem of items) {
      const saleItem = sale.items.find(
        (si: { product: { toString: () => string }; qty: number; productName: string; salePrice: number }) =>
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

      returnedItems.push({
        product: returnItem.product,
        productName: saleItem.productName,
        qty,
        salePrice: saleItem.salePrice,
      })

      // Restore stock
      await Product.findByIdAndUpdate(returnItem.product, { $inc: { stock: qty } })
    }

    if (returnedItems.length === 0) {
      return NextResponse.json({ error: 'Nothing to return' }, { status: 400 })
    }

    // Update sale
    await Sale.findByIdAndUpdate(id, {
      $push: { returnedItems: { $each: returnedItems } },
      $inc: { returnedTotal: returnTotal },
    })

    // If sale had debt, reduce it
    if (sale.customer && (sale.paymentType === 'partial' || sale.paymentType === 'debt')) {
      const debt = await Debt.findOne({ sale: sale._id, status: 'active' })
      if (debt) {
        const reduce = Math.min(returnTotal, debt.remainingAmount)
        if (reduce > 0) {
          debt.remainingAmount -= reduce
          debt.totalAmount -= returnTotal
          if (debt.remainingAmount <= 0) {
            debt.status = 'paid'
            debt.remainingAmount = 0
          }
          await debt.save()

          // Update customer totalDebt
          await Customer.findByIdAndUpdate(sale.customer, { $inc: { totalDebt: -reduce } })
        }
      }
    }

    return NextResponse.json({ returnedItems, returnTotal }, { status: 200 })
  } catch (err) { return errorResponse(err) }
}
