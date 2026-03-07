import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Product from '@/models/Product'

export async function GET() {
  try {
    await connectDB()

    const [stats, lowStockCount] = await Promise.all([
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalCostValue: { $sum: { $multiply: ['$costPrice', '$stock'] } },
            totalSaleValue: { $sum: { $multiply: ['$salePrice', '$stock'] } },
          },
        },
      ]),
      Product.countDocuments({ isActive: true, stock: { $lte: 5 } }),
    ])

    const s = stats[0] || { totalProducts: 0, totalCostValue: 0, totalSaleValue: 0 }

    return NextResponse.json({
      totalProducts: s.totalProducts,
      totalCostValue: s.totalCostValue,
      totalSaleValue: s.totalSaleValue,
      lowStockCount,
    })
  } catch (err) { return errorResponse(err) }
}
