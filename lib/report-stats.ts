// Shared day/period stats — single source of truth for the dashboard API
// (app/api/reports/route.ts) and the Telegram bot (bot/reports/daily-sales.ts),
// so both always show identical numbers.
// Relative imports (not @/) so the bot's tsx runtime can resolve them.
import Sale from '../models/Sale'
import Expense from '../models/Expense'
import Debt from '../models/Debt'

export interface PaymentMethodStat {
  method: string
  total: number
  count: number
}

export interface ReportStats {
  salesCount: number
  salesRevenue: number
  debtRevenue: number
  crossPeriodReturns: number
  totalRevenue: number
  totalProfit: number
  totalExpenses: number
  netProfit: number
  newDebt: number
  paidDebt: number
  paymentMethods: PaymentMethodStat[]
}

export async function getReportStats(fromDate: Date, toDate: Date): Promise<ReportStats> {
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

  const [
    salesCount,
    [salesAgg],
    [manualDebtPaymentsAgg],
    [crossPeriodReturnsAgg],
    [expensesAgg],
    [newDebtAgg],
    [paidDebtAgg],
    paymentMethodStats,
    manualDebtPaymentsByMethod,
  ] = await Promise.all([
    salesCountP,
    salesAggP,
    manualDebtPaymentsAggP,
    crossPeriodReturnsAggP,
    expensesAggP,
    newDebtAggP,
    paidDebtAggP,
    paymentMethodStatsP,
    manualDebtPaymentsByMethodP,
  ])

  // Merge payment methods (sales + manual debt payments)
  const paymentMethodMap = new Map<string, PaymentMethodStat>(
    paymentMethodStats.map((p: PaymentMethodStat) => [p.method, p])
  )
  for (const mp of manualDebtPaymentsByMethod) {
    const existing = paymentMethodMap.get(mp.method)
    if (existing) {
      existing.total += mp.total
      existing.count += mp.count
    } else {
      paymentMethodMap.set(mp.method, mp)
    }
  }
  const paymentMethods = Array.from(paymentMethodMap.values())

  const manualDebtPayments = manualDebtPaymentsAgg?.totalPayments || 0
  const debtProfit = manualDebtPaymentsAgg?.totalProfit || 0
  const crossReturnRevenue = crossPeriodReturnsAgg?.returnedRevenue || 0
  const crossReturnCost = crossPeriodReturnsAgg?.returnedCost || 0
  const totalRevenue = (salesAgg?.totalRevenue || 0) + manualDebtPayments - crossReturnRevenue
  const totalProfit = (salesAgg?.totalProfit || 0) + debtProfit + (crossReturnCost - crossReturnRevenue)
  const totalExpenses = expensesAgg?.totalExpenses || 0

  return {
    salesCount,
    salesRevenue: salesAgg?.totalRevenue || 0,
    debtRevenue: manualDebtPayments,
    crossPeriodReturns: crossReturnRevenue,
    totalRevenue,
    totalProfit,
    totalExpenses,
    netProfit: totalProfit - totalExpenses,
    newDebt: newDebtAgg?.newDebt || 0,
    paidDebt: paidDebtAgg?.paidDebt || 0,
    paymentMethods,
  }
}
