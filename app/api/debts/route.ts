import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'

export async function GET(req: Request) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const customer = searchParams.get('customer')

    const category = searchParams.get('category')

    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (customer) filter.customer = customer
    if (category) filter.category = category
    filter.$or = [{ type: 'customer' }, { type: { $exists: false } }]

    const debts = await Debt.find(filter)
      .populate('category', 'name')
      .populate('sale', 'total paid createdAt paymentType items')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()

    return NextResponse.json(debts)
  } catch (err) { return errorResponse(err) }
}

export async function POST(req: Request) {
  try {
    await connectDB()
    const { customerName, customerPhone, amount, note, category } = await req.json()

    if (!customerName || !amount) {
      return NextResponse.json({ error: 'customerName and amount required' }, { status: 400 })
    }

    const trimmedName = customerName.trim()
    const trimmedPhone = customerPhone?.trim() || ''

    // Check if there's an existing active debt for this customer (by name and phone)
    // If phone is empty, match by name only; otherwise match by both name and phone
    let query: Record<string, unknown>

    if (trimmedPhone) {
      // If phone provided, match by both name and phone
      query = {
        customerName: trimmedName,
        customerPhone: trimmedPhone,
        status: 'active',
        type: 'customer',
        sale: { $exists: false },
      }
    } else {
      // If no phone provided, match by name and (no phone OR empty phone OR null phone)
      query = {
        $and: [
          { customerName: trimmedName },
          { status: 'active' },
          { type: 'customer' },
          { sale: { $exists: false } },
          {
            $or: [
              { customerPhone: { $exists: false } },
              { customerPhone: '' },
              { customerPhone: null }
            ]
          }
        ]
      }
    }

    const existingDebt = await Debt.findOne(query)

    if (existingDebt) {
      // Add to existing debt
      existingDebt.totalAmount += amount
      existingDebt.remainingAmount += amount
      if (note) {
        existingDebt.note = existingDebt.note 
          ? `${existingDebt.note}\n---\n${note}` 
          : note
      }
      await existingDebt.save()
      return NextResponse.json(existingDebt, { status: 200 })
    }

    // Create new debt if no existing active debt found
    const debt = await Debt.create({
      customerName: trimmedName,
      customerPhone: trimmedPhone || undefined,
      totalAmount: amount,
      paidAmount: 0,
      remainingAmount: amount,
      note,
      category: category || undefined,
      type: 'customer',
    })

    return NextResponse.json(debt, { status: 201 })
  } catch (err) { return errorResponse(err) }
}
