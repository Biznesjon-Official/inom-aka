import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { errorResponse } from '@/lib/api-utils'
import Sale from '@/models/Sale'
import Expense from '@/models/Expense'
import Debt from '@/models/Debt'
import PersonalDebt from '@/models/PersonalDebt'
import Product from '@/models/Product'

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
    }

    const fromDate = new Date(from + 'T00:00:00')
    const toDate = new Date(to + 'T23:59:59.999')

    const dateFilter = { $gte: fromDate, $lte: toDate }

    // Sales count
    const salesCountP = Sale.countDocuments({ createdAt: dateFilter })

    // Sales revenue/profit
    const salesAggP = Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$_id',
          total: { $first: '$total' },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
          periodPaid: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$payments', []] }, as: 'p',
                  cond: { $and: [{ $gte: ['$$p.date', fromDate] }, { $lte: ['$$p.date', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.amount'] },
              },
            },
          },
          periodReturnedTotal: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                  cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.salePrice', '$$this.qty'] }] },
              },
            },
          },
          periodReturnedCostTotal: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                  cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.costPrice', '$$this.qty'] }] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $subtract: [
                '$periodPaid',
                { $max: [0, { $subtract: ['$periodReturnedTotal', { $subtract: ['$total', '$periodPaid'] }] }] },
              ],
            },
          },
          totalProfit: {
            $sum: {
              $max: [0, {
                $subtract: [
                  { $subtract: ['$periodPaid', { $max: [0, { $subtract: ['$periodReturnedTotal', { $subtract: ['$total', '$periodPaid'] }] }] }] },
                  { $subtract: ['$cost', '$periodReturnedCostTotal'] },
                ],
              }],
            },
          },
        },
      },
    ]).allowDiskUse(true)

    // Qarz to'lovlari — sale shu periodda yaratilmagan bo'lsa kirimga qo'sh
    // $$saleId — let bilan belgilangan o'zgaruvchi
    const manualDebtPaymentsAggP = Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      // Count as debt income only if the payment's OWN sale (saleRef) was NOT created in this period.
      // Period-sale payments are already in salesRevenue via Sale.payments — prevents double counting.
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$_id', '$$srf'] },
              { $gte: ['$createdAt', fromDate] },
              { $lte: ['$createdAt', toDate] },
            ] } } },
            { $project: { _id: 1 } },
          ],
          as: 'payInPeriod',
        },
      },
      { $match: { payInPeriod: { $size: 0 } } },
      // Cost/profit from the payment's own sale (saleRef), not the debt's top-level sale
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [ { $match: { $expr: { $eq: ['$_id', '$$srf'] } } } ],
          as: 'saleDoc',
        },
      },
      { $unwind: { path: '$saleDoc', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$saleDoc.items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { debtId: '$_id', pmtDate: '$payments.date', pmtAmt: '$payments.amount' },
          totalPayments: { $first: '$payments.amount' },
          hasSale: { $first: { $cond: [{ $ifNull: ['$saleDoc._id', false] }, true, false] } },
          salePayedBefore: { $first: { $ifNull: ['$payments.salePayedBefore', 0] } },
          saleCost: { $sum: { $multiply: [{ $ifNull: ['$saleDoc.items.costPrice', 0] }, { $ifNull: ['$saleDoc.items.qty', 0] }] } },
          saleRetCost: { $first: { $ifNull: ['$saleDoc.returnedCostTotal', 0] } },
        },
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: '$totalPayments' },
          totalProfit: {
            $sum: {
              $cond: [
                '$hasSale',
                // Sotuvga bog'liq qarz: foyda = to'lov - tannarx
                {
                  $subtract: [
                    { $max: [0, { $subtract: [{ $add: ['$salePayedBefore', '$totalPayments'] }, { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
                    { $max: [0, { $subtract: ['$salePayedBefore', { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
                  ],
                },
                // Qo'lda qo'shilgan qarz (sale yo'q): foyda = to'lov summasi
                '$totalPayments',
              ],
            },
          },
        },
      },
    ]).allowDiskUse(true)

    // Returns on sales created BEFORE this period but returned IN this period
    const crossPeriodReturnsAggP = Sale.aggregate([
      { $match: { createdAt: { $lt: fromDate } } },
      {
        $addFields: {
          periodReturnedTotal: {
            $reduce: {
              input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
              initialValue: 0,
              in: { $add: ['$$value', { $multiply: ['$$this.salePrice', '$$this.qty'] }] },
            },
          },
          periodReturnedCostTotal: {
            $reduce: {
              input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
              initialValue: 0,
              in: { $add: ['$$value', { $multiply: ['$$this.costPrice', '$$this.qty'] }] },
            },
          },
        },
      },
      { $match: { periodReturnedTotal: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          returnedRevenue: { $sum: '$periodReturnedTotal' },
          returnedCost: { $sum: '$periodReturnedCostTotal' },
        },
      },
    ]).allowDiskUse(true)

    // Expenses
    const expensesAggP = Expense.aggregate([
      { $match: { date: dateFilter } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
    ]).allowDiskUse(true)

    // newDebt
    const newDebtAggP = Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $group: {
        _id: null,
        newDebt: { $sum: { $max: [0, { $subtract: [
          { $subtract: ['$total', '$paid'] },
          { $ifNull: ['$returnedTotal', 0] },
        ]}] } },
      }},
    ]).allowDiskUse(true)

    // paidDebt — faqat oldingi davr sotuvlari uchun to'lovlar
    const paidDebtAggP = Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.refunded': { $ne: true }, 'payments.fromSale': { $ne: true } } },
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$_id', '$$srf'] },
              { $gte: ['$createdAt', fromDate] },
              { $lte: ['$createdAt', toDate] },
            ] } } },
            { $project: { _id: 1 } },
          ],
          as: 'payInPeriod',
        },
      },
      { $match: { payInPeriod: { $size: 0 } } },
      { $group: { _id: null, paidDebt: { $sum: '$payments.amount' } } },
    ]).allowDiskUse(true)

    // Detail list of the debt payments that make up debtRevenue (who/when/from-whom)
    const debtPaymentDetailsP = Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$_id', '$$srf'] },
              { $gte: ['$createdAt', fromDate] },
              { $lte: ['$createdAt', toDate] },
            ] } } },
            { $project: { _id: 1 } },
          ],
          as: 'payInPeriod',
        },
      },
      { $match: { payInPeriod: { $size: 0 } } },
      { $lookup: { from: 'users', localField: 'payments.collectedBy', foreignField: '_id', as: 'collector', pipeline: [{ $project: { name: 1 } }] } },
      {
        $project: {
          _id: 0,
          customerName: 1,
          amount: '$payments.amount',
          date: '$payments.date',
          method: { $ifNull: ['$payments.method', 'cash'] },
          collectedByName: { $arrayElemAt: ['$collector.name', 0] },
        },
      },
      { $sort: { date: -1 } },
    ]).allowDiskUse(true)

    // Static data
    const customerDebtAggP = Debt.aggregate([{ $match: { status: 'active', $or: [{ type: 'customer' }, { type: { $exists: false } }] } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]).allowDiskUse(true)
    const personalDebtAggP = PersonalDebt.aggregate([{ $match: { status: 'active' } }, { $group: { _id: null, total: { $sum: '$remainingAmount' } } }]).allowDiskUse(true)
    const productStatsAggP = Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, totalProducts: { $sum: 1 }, warehouseValue: { $sum: { $multiply: ['$costPrice', '$stock'] } } } }]).allowDiskUse(true)

    // Daily breakdown
    const dailyBreakdownP = Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            sid: '$_id',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            total: '$total',
          },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
          periodPaid: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$payments', []] }, as: 'p',
                  cond: { $and: [{ $gte: ['$$p.date', fromDate] }, { $lte: ['$$p.date', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', '$$this.amount'] },
              },
            },
          },
          periodReturnedTotal: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                  cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.salePrice', '$$this.qty'] }] },
              },
            },
          },
          periodReturnedCostTotal: {
            $first: {
              $reduce: {
                input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                  cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
                initialValue: 0,
                in: { $add: ['$$value', { $multiply: ['$$this.costPrice', '$$this.qty'] }] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          revenue: {
            $sum: {
              $subtract: [
                '$periodPaid',
                { $max: [0, { $subtract: ['$periodReturnedTotal', { $subtract: ['$_id.total', '$periodPaid'] }] }] },
              ],
            },
          },
          profit: {
            $sum: {
              $max: [0, {
                $subtract: [
                  { $subtract: ['$periodPaid', { $max: [0, { $subtract: ['$periodReturnedTotal', { $subtract: ['$_id.total', '$periodPaid'] }] }] }] },
                  { $subtract: ['$cost', '$periodReturnedCostTotal'] },
                ],
              }],
            },
          },
          sales: { $addToSet: '$_id.sid' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: 1,
          profit: 1,
          sales: { $size: '$sales' },
        },
      },
      { $sort: { date: 1 } },
    ]).allowDiskUse(true)

    // Daily expenses
    const dailyExpensesP = Expense.aggregate([
      { $match: { date: dateFilter } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          expense: { $sum: '$amount' },
        },
      },
      { $project: { _id: 0, date: '$_id', expense: 1 } },
    ]).allowDiskUse(true)

    // Daily qarz to'lovlari
    const dailyManualDebtPaymentsP = Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$_id', '$$srf'] },
              { $gte: ['$createdAt', fromDate] },
              { $lte: ['$createdAt', toDate] },
            ] } } },
            { $project: { _id: 1 } },
          ],
          as: 'payInPeriod',
        },
      },
      { $match: { payInPeriod: { $size: 0 } } },
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [ { $match: { $expr: { $eq: ['$_id', '$$srf'] } } } ],
          as: 'saleDoc',
        },
      },
      { $unwind: { path: '$saleDoc', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$saleDoc.items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$payments.date' } }, debtId: '$_id', pmtAmt: '$payments.amount' },
          pmtAmt: { $first: '$payments.amount' },
          hasSale: { $first: { $cond: [{ $ifNull: ['$saleDoc._id', false] }, true, false] } },
          salePayedBefore: { $first: { $ifNull: ['$payments.salePayedBefore', 0] } },
          saleCost: { $sum: { $multiply: [{ $ifNull: ['$saleDoc.items.costPrice', 0] }, { $ifNull: ['$saleDoc.items.qty', 0] }] } },
          saleRetCost: { $first: { $ifNull: ['$saleDoc.returnedCostTotal', 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          manualPayment: { $sum: '$pmtAmt' },
          manualProfit: {
            $sum: {
              $cond: [
                '$hasSale',
                {
                  $subtract: [
                    { $max: [0, { $subtract: [{ $add: ['$salePayedBefore', '$pmtAmt'] }, { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
                    { $max: [0, { $subtract: ['$salePayedBefore', { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
                  ],
                },
                '$pmtAmt',
              ],
            },
          },
        },
      },
      { $project: { _id: 0, date: '$_id', manualPayment: 1, manualProfit: 1 } },
    ]).allowDiskUse(true)

    // Payment methods
    const paymentMethodStatsP = Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter } },
      { $group: { _id: '$payments.method', total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    ]).allowDiskUse(true)

    const manualDebtPaymentsByMethodP = Debt.aggregate([
      { $unwind: '$payments' },
      { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
      {
        $lookup: {
          from: 'sales',
          let: { srf: '$payments.saleRef' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$_id', '$$srf'] },
              { $gte: ['$createdAt', fromDate] },
              { $lte: ['$createdAt', toDate] },
            ] } } },
            { $project: { _id: 1 } },
          ],
          as: 'payInPeriod',
        },
      },
      { $match: { payInPeriod: { $size: 0 } } },
      { $group: { _id: { $ifNull: ['$payments.method', 'cash'] }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
      { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    ]).allowDiskUse(true)

    // Cashier stats
    const cashierStatsP = Sale.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $addFields: {
          periodReturnedTotal: {
            $reduce: {
              input: { $filter: { input: { $ifNull: ['$returnedItems', []] }, as: 'ri',
                cond: { $and: [{ $gte: ['$$ri.returnedAt', fromDate] }, { $lte: ['$$ri.returnedAt', toDate] }] } } },
              initialValue: 0,
              in: { $add: ['$$value', { $multiply: ['$$this.salePrice', '$$this.qty'] }] },
            },
          },
        },
      },
      {
        $group: {
          _id: '$cashier',
          salesCount: { $sum: 1 },
          totalAmount: { $sum: { $subtract: ['$total', '$periodReturnedTotal'] } },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          name: '$user.name',
          salesCount: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]).allowDiskUse(true)

    // Run all independent aggregations in parallel (was sequential — main dashboard bottleneck)
    const [
      salesCount,
      [salesAgg],
      [manualDebtPaymentsAgg],
      [crossPeriodReturnsAgg],
      [expensesAgg],
      [newDebtAgg],
      [paidDebtAgg],
      customerDebtAgg,
      personalDebtAgg,
      productStatsAgg,
      dailyBreakdown,
      dailyExpenses,
      dailyManualDebtPayments,
      paymentMethodStats,
      manualDebtPaymentsByMethod,
      cashierStats,
      debtPaymentDetails,
    ] = await Promise.all([
      salesCountP,
      salesAggP,
      manualDebtPaymentsAggP,
      crossPeriodReturnsAggP,
      expensesAggP,
      newDebtAggP,
      paidDebtAggP,
      customerDebtAggP,
      personalDebtAggP,
      productStatsAggP,
      dailyBreakdownP,
      dailyExpensesP,
      dailyManualDebtPaymentsP,
      paymentMethodStatsP,
      manualDebtPaymentsByMethodP,
      cashierStatsP,
      debtPaymentDetailsP,
    ])

    // Merge daily data
    const dailyMap = new Map<string, { date: string; revenue: number; profit: number; expense: number; sales: number }>()

    for (const d of dailyBreakdown) {
      dailyMap.set(d.date, { date: d.date, revenue: d.revenue, profit: d.profit, expense: 0, sales: d.sales })
    }
    for (const d of dailyManualDebtPayments) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.revenue += d.manualPayment
        existing.profit += d.manualProfit || 0
      } else {
        dailyMap.set(d.date, { date: d.date, revenue: d.manualPayment, profit: d.manualProfit || 0, expense: 0, sales: 0 })
      }
    }
    for (const d of dailyExpenses) {
      const existing = dailyMap.get(d.date)
      if (existing) {
        existing.expense = d.expense
      } else {
        dailyMap.set(d.date, { date: d.date, revenue: 0, profit: 0, expense: d.expense, sales: 0 })
      }
    }

    const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // Merge payment methods
    const paymentMethodMap = new Map(paymentMethodStats.map((p: { method: string; total: number; count: number }) => [p.method, p]))
    for (const mp of manualDebtPaymentsByMethod) {
      const existing = paymentMethodMap.get(mp.method)
      if (existing) {
        existing.total += mp.total
        existing.count += mp.count
      } else {
        paymentMethodMap.set(mp.method, mp)
      }
    }
    const mergedPaymentMethods = Array.from(paymentMethodMap.values())

    // Total calculations
    const manualDebtPayments = manualDebtPaymentsAgg?.totalPayments || 0
    const debtProfit = manualDebtPaymentsAgg?.totalProfit || 0
    const crossReturnRevenue = crossPeriodReturnsAgg?.returnedRevenue || 0
    const crossReturnCost = crossPeriodReturnsAgg?.returnedCost || 0
    const totalRevenue = (salesAgg?.totalRevenue || 0) + manualDebtPayments - crossReturnRevenue
    const totalProfit = (salesAgg?.totalProfit || 0) + debtProfit + (crossReturnCost - crossReturnRevenue)

    return NextResponse.json({
      salesCount,
      salesRevenue: salesAgg?.totalRevenue || 0,
      debtRevenue: manualDebtPayments,
      crossPeriodReturns: crossReturnRevenue,
      totalRevenue,
      totalProfit,
      totalExpenses: expensesAgg?.totalExpenses || 0,
      netProfit: totalProfit - (expensesAgg?.totalExpenses || 0),
      newDebt: newDebtAgg?.newDebt || 0,
      paidDebt: paidDebtAgg?.paidDebt || 0,
      daily,
      cashierStats,
      debtPaymentDetails,
      paymentMethods: mergedPaymentMethods,
      customerDebt: customerDebtAgg[0]?.total || 0,
      personalDebt: personalDebtAgg[0]?.total || 0,
      totalProducts: productStatsAgg[0]?.totalProducts || 0,
      warehouseValue: productStatsAgg[0]?.warehouseValue || 0,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
