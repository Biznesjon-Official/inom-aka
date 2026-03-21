import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Debt from '@/models/Debt'

export async function GET() {
  try {
    await connectDB()
    const debtorsAgg = await Debt.aggregate([
      {
        $match: {
          $or: [{ type: 'customer' }, { type: { $exists: false } }],
          customerName: { $nin: [null, ''] }
        }
      },
      {
        $group: {
          _id: { name: '$customerName', phone: '$customerPhone' },
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id.name',
          phone: '$_id.phone'
        }
      },
      { $sort: { name: 1 } }
    ])
    
    return NextResponse.json(debtorsAgg)
  } catch (err) { return errorResponse(err) }
}
