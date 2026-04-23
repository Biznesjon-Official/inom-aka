/* eslint-disable @typescript-eslint/no-explicit-any */
import Sale from '../../models/Sale'
import Expense from '../../models/Expense'
import Debt from '../../models/Debt'
import { sendToAll, sendTo } from '../utils/send'
import { formatPrice, getTodayRange, formatDate } from '../utils/format'

export async function sendDailySalesReport(bot: any, chatId?: string | number): Promise<void> {
  const { from, to } = getTodayRange()
  const dateFilter = { $gte: from, $lte: to }

  // Sales count — createdAt bo'yicha
  const salesCount = await Sale.countDocuments({ createdAt: dateFilter })

  // Sales revenue/profit — payments.date bo'yicha, returnRatio hisobga olingan
  const [salesAgg] = await Sale.aggregate([
    { $unwind: '$payments' },
    { $match: { 'payments.date': dateFilter } },
    {
      $project: {
        paymentAmount: '$payments.amount',
        total: '$total',
        items: '$items',
        returnedTotal: { $ifNull: ['$returnedTotal', 0] },
        returnedCostTotal: { $ifNull: ['$returnedCostTotal', 0] },
      },
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: { sid: '$_id', pamt: '$paymentAmount', tot: '$total', rt: '$returnedTotal', rct: '$returnedCostTotal' },
        cost: { $sum: { $multiply: ['$items.costPrice', '$items.qty'] } },
      },
    },
    {
      $addFields: {
        returnRatio: { $cond: [{ $gt: ['$_id.tot', 0] }, { $divide: [{ $subtract: ['$_id.tot', '$_id.rt'] }, '$_id.tot'] }, 1] },
      },
    },
    {
      $project: {
        effectivePamt: { $multiply: ['$_id.pamt', '$returnRatio'] },
        pamt: '$_id.pamt',
        tot: '$_id.tot',
        profit: { $subtract: [{ $subtract: ['$_id.tot', '$_id.rt'] }, { $subtract: ['$cost', '$_id.rct'] }] },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$effectivePamt' },
        totalProfit: { $sum: { $cond: [{ $gt: ['$tot', 0] }, { $multiply: ['$profit', { $divide: ['$pamt', '$tot'] }] }, 0] } },
      },
    },
  ]).allowDiskUse(true)

  // Manual debt payments — sale shu periodda yaratilmagan bo'lsa kirimga qo'sh
  const [manualDebtPaymentsAgg] = await Debt.aggregate([
    {
      $lookup: {
        from: 'sales',
        let: { saleId: '$sale' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$_id', '$saleId'] },
            { $gte: ['$createdAt', from] },
            { $lte: ['$createdAt', to] },
          ] } } },
          { $project: { _id: 1 } },
        ],
        as: 'saleInPeriod',
      },
    },
    { $match: { saleInPeriod: { $size: 0 } } },
    { $unwind: '$payments' },
    { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
    {
      $lookup: {
        from: 'sales',
        localField: 'sale',
        foreignField: '_id',
        as: 'saleDoc',
      },
    },
    { $unwind: { path: '$saleDoc', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$saleDoc.items', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { debtId: '$_id', pmtDate: '$payments.date', pmtAmt: '$payments.amount' },
        totalPayments: { $first: '$payments.amount' },
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
            $subtract: [
              { $max: [0, { $subtract: [{ $add: ['$salePayedBefore', '$totalPayments'] }, { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
              { $max: [0, { $subtract: ['$salePayedBefore', { $subtract: ['$saleCost', '$saleRetCost'] }] }] },
            ],
          },
        },
      },
    },
  ]).allowDiskUse(true)

  // Expenses
  const [expensesAgg] = await Expense.aggregate([
    { $match: { date: dateFilter } },
    { $group: { _id: null, totalExpenses: { $sum: '$amount' } } },
  ]).allowDiskUse(true)

  // Payment methods — returnRatio hisobga olingan
  const paymentMethodStats = await Sale.aggregate([
    { $unwind: '$payments' },
    { $match: { 'payments.date': dateFilter } },
    {
      $addFields: {
        returnRatio: { $cond: [
          { $gt: ['$total', 0] },
          { $divide: [{ $subtract: ['$total', { $ifNull: ['$returnedTotal', 0] }] }, '$total'] },
          1,
        ]},
      },
    },
    { $group: { _id: '$payments.method', total: { $sum: { $multiply: ['$payments.amount', '$returnRatio'] } }, count: { $sum: 1 } } },
    { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
  ]).allowDiskUse(true)

  // Manual debt payments by method — sale shu periodda yaratilmagan bo'lsa kirimga qo'sh
  const manualDebtPaymentsByMethod = await Debt.aggregate([
    {
      $lookup: {
        from: 'sales',
        let: { saleId: '$sale' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$_id', '$saleId'] },
            { $gte: ['$createdAt', from] },
            { $lte: ['$createdAt', to] },
          ] } } },
          { $project: { _id: 1 } },
        ],
        as: 'saleInPeriod',
      },
    },
    { $match: { saleInPeriod: { $size: 0 } } },
    { $unwind: '$payments' },
    { $match: { 'payments.date': dateFilter, 'payments.fromSale': { $ne: true }, 'payments.refunded': { $ne: true } } },
    { $group: { _id: { $ifNull: ['$payments.method', 'cash'] }, total: { $sum: '$payments.amount' }, count: { $sum: 1 } } },
    { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
  ]).allowDiskUse(true)

  // Merge payment methods
  const paymentMethodMap = new Map(paymentMethodStats.map((p: any) => [p.method, { ...p }]))
  for (const mp of manualDebtPaymentsByMethod) {
    const existing = paymentMethodMap.get(mp.method)
    if (existing) {
      existing.total += mp.total
      existing.count += mp.count
    } else {
      paymentMethodMap.set(mp.method, { ...mp })
    }
  }
  const mergedPaymentMethods = Array.from(paymentMethodMap.values())

  const manualDebtPayments = manualDebtPaymentsAgg?.totalPayments || 0
  const debtProfit = manualDebtPaymentsAgg?.totalProfit || 0
  const totalRevenue = (salesAgg?.totalRevenue || 0) + manualDebtPayments
  const totalProfit = (salesAgg?.totalProfit || 0) + debtProfit
  const totalExpenses = expensesAgg?.totalExpenses || 0
  const netProfit = totalProfit - totalExpenses

  const methodNames: Record<string, string> = { cash: 'Naqd', card: 'Karta', terminal: 'Terminal' }

  const lines: string[] = [
    '<b>BUGUNGI SOTUV HISOBOTI</b>',
    formatDate(from),
    '━━━━━━━━━━━━━━━━━━━━',
    `Sotuvlar: ${salesCount} ta`,
    `Tushum: ${formatPrice(totalRevenue)}`,
    `Foyda: ${formatPrice(totalProfit)}`,
    `Xarajat: ${formatPrice(totalExpenses)}`,
    `Sof foyda: ${formatPrice(netProfit)}`,
    '━━━━━━━━━━━━━━━━━━━━',
    'To\'lov turlari:',
  ]

  for (const pm of mergedPaymentMethods) {
    const name = methodNames[pm.method] || pm.method
    lines.push(`  ${name}: ${formatPrice(pm.total)} (${pm.count} ta)`)
  }

  if (mergedPaymentMethods.length === 0) {
    lines.push('  Ma\'lumot yo\'q')
  }

  const text = lines.join('\n')
  chatId ? await sendTo(bot, chatId, text) : await sendToAll(bot, text)
}
