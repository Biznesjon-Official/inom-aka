'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice, calcSaleRevenue, calcSaleProfit, PAYMENT_STATUS, PAYMENT_METHODS } from '@/lib/utils'
import { printReceipt } from '@/lib/print'
import { RefreshCw, Printer, Undo2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SaleItem {
  product?: string
  productName: string
  qty: number
  salePrice: number
  costPrice: number
  unit: string
}

interface Sale {
  _id: string
  receiptNo: number
  total: number
  paid: number
  paymentType: string
  customer?: { name: string }
  cashier?: { name: string }
  usta?: { name: string }
  items: SaleItem[]
  returnedItems?: { product: string; productName: string; qty: number; salePrice: number; costPrice?: number }[]
  returnedTotal?: number
  createdAt: string
}

export default function SalesLog({ cashierId }: { cashierId?: string }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [debtPayments, setDebtPayments] = useState<{ _id: string; customerName: string; totalAmount: number; todayPaid: number; todayPayments: { amount: number; method: string; date: string }[] }[]>([])
  const [loading, setLoading] = useState(false)

  // Return state
  const [returnDialog, setReturnDialog] = useState(false)
  const [returnSale, setReturnSale] = useState<Sale | null>(null)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [returnQtyInputs, setReturnQtyInputs] = useState<Record<string, string>>({})
  const [returnLoading, setReturnLoading] = useState(false)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ today: '1' })
    if (cashierId) params.set('cashier', cashierId)
    const [salesRes, debtsRes] = await Promise.all([
      fetch(`/api/sales?${params}`),
      cashierId ? Promise.resolve(null) : fetch('/api/debts?todayPayments=1'),
    ])
    const salesData = await salesRes.json()
    const debtsData = debtsRes ? await debtsRes.json() : []
    setSales(Array.isArray(salesData) ? salesData : [])
    setDebtPayments(Array.isArray(debtsData) ? debtsData : [])
    setLoading(false)
  }, [cashierId])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSales() }, [fetchSales])

  function openReturn(sale: Sale) {
    setReturnSale(sale)
    const qtys: Record<string, number> = {}
    for (const item of sale.items) {
      if (item.product) qtys[item.product] = 0
    }
    setReturnQtys(qtys)
    setReturnQtyInputs({})
    setReturnDialog(true)
  }

  function getReturnableQty(sale: Sale, productId: string): number {
    const saleItem = sale.items.find(i => i.product === productId)
    if (!saleItem) return 0
    const alreadyReturned = (sale.returnedItems || [])
      .filter(ri => ri.product === productId)
      .reduce((s, ri) => s + ri.qty, 0)
    return saleItem.qty - alreadyReturned
  }

  async function handleReturn() {
    if (!returnSale) return
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([product, qty]) => ({ product, qty }))

    if (items.length === 0) return toast.error('Qaytariladigan mahsulot tanlang')

    setReturnLoading(true)
    const res = await fetch(`/api/sales/${returnSale._id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setReturnLoading(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return toast.error(err.error || 'Xato yuz berdi')
    }

    const result = await res.json()
    toast.success(`${formatPrice(result.returnTotal)} qaytarildi`)
    setReturnDialog(false)
    fetchSales()
  }

  const todaySalesRevenue = sales.reduce((s, x) => s + calcSaleRevenue(x), 0)
  const todayDebtRevenue = debtPayments.reduce((s, d) => s + d.todayPaid, 0)
  const todayRevenue = todaySalesRevenue
  const todayTotal = sales.reduce((s, x) => s + x.total - (x.returnedTotal || 0), 0)
  const todayProfit = sales.reduce((s, x) => s + calcSaleProfit(x), 0)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Bugungi savdolar</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchSales} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>{sales.length} ta sotuv</span>
          <span>Kirim: <span className="font-medium text-slate-700">{formatPrice(todayRevenue)}</span></span>
          <span>Foyda: <span className="font-medium text-emerald-700">{formatPrice(todayProfit)}</span></span>
          {todayDebtRevenue > 0 && (
            <span>Qarz to&apos;lov: <span className="font-medium text-green-600">+{formatPrice(todayDebtRevenue)}</span></span>
          )}
          {todayTotal > todaySalesRevenue && (
            <span>Qarz: <span className="font-medium text-orange-600">{formatPrice(todayTotal - todaySalesRevenue)}</span></span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sales">
          <TabsList className="h-8 text-xs">
            <TabsTrigger value="sales" className="text-xs">Savdolar ({sales.length})</TabsTrigger>
            {!cashierId && <TabsTrigger value="debt-payments" className="text-xs">Qarz to&apos;lovlari</TabsTrigger>}
          </TabsList>

          <TabsContent value="sales" className="mt-2">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sales.map(sale => (
                <div key={sale._id} className="p-2 bg-slate-50 rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{new Date(sale.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                      {sale.receiptNo && <span className="text-slate-400">#{sale.receiptNo}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-0.5 hover:bg-orange-50 rounded"
                        title="Tovar qaytarish"
                        onClick={() => openReturn(sale)}
                      >
                        <Undo2 className="w-3 h-3 text-orange-400" />
                      </button>
                      <button
                        className="p-0.5 hover:bg-blue-50 rounded"
                        title="Chekni qayta chop etish"
                        onClick={() => printReceipt({
                          receiptNo: sale.receiptNo,
                          items: sale.items,
                          total: sale.total,
                          paid: sale.paid,
                          cashier: sale.cashier?.name || 'Kassir',
                          customer: sale.customer?.name,
                          paymentType: sale.paymentType,
                          createdAt: new Date(sale.createdAt),
                        })}
                      >
                        <Printer className="w-3 h-3 text-blue-400" />
                      </button>
                      <Badge variant={PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.variant} className="text-xs h-4">
                        {PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    {sale.cashier?.name && <span>{sale.cashier.name}</span>}
                    {sale.usta?.name && <span className="text-purple-600">• Usta: {sale.usta.name}</span>}
                    {sale.customer && <span>— {sale.customer.name}</span>}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">{sale.items.length} ta mahsulot</span>
                    <div className="text-right">
                      <span className="font-bold text-slate-800">{formatPrice(sale.total)}</span>
                      {(sale.returnedTotal || 0) > 0 && (
                        <div className="text-orange-500 text-[10px]">Qaytarildi: {formatPrice(sale.returnedTotal!)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sales.length === 0 && (
                <div className="text-center text-slate-400 py-4">Savdo yo&apos;q</div>
              )}
            </div>
          </TabsContent>

          {!cashierId && (
            <TabsContent value="debt-payments" className="mt-2">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {debtPayments.map(d => (
                  <div key={d._id} className="p-2 bg-slate-50 rounded-lg text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-slate-700">{d.customerName}</span>
                      <span className="font-bold text-green-600">+{formatPrice(d.todayPaid)}</span>
                    </div>
                    {d.todayPayments.map((p, i) => (
                      <div key={i} className="flex justify-between text-slate-400">
                        <span>{new Date(p.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })} — {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method}</span>
                        <span>{formatPrice(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {debtPayments.length === 0 && (
                  <div className="text-center text-slate-400 py-4">Bugun qarz to&apos;lovi yo&apos;q</div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>

      {/* Return dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tovar qaytarish {returnSale?.receiptNo && `#${returnSale.receiptNo}`}</DialogTitle>
          </DialogHeader>
          {returnSale && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {returnSale.items.map(item => {
                  if (!item.product) return null
                  const maxQty = getReturnableQty(returnSale, item.product)
                  if (maxQty <= 0) return (
                    <div key={item.product} className="p-2 bg-slate-50 rounded-lg text-xs opacity-50">
                      <span className="text-slate-500">{item.productName} — to&apos;liq qaytarilgan</span>
                    </div>
                  )
                  const qty = returnQtys[item.product] || 0
                  return (
                    <div key={item.product} className="p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.productName}</div>
                          <div className="text-xs text-slate-500">{formatPrice(item.salePrice)} x {item.qty} {item.unit}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            onClick={() => setReturnQtys(p => ({ ...p, [item.product!]: Math.max(0, Math.round((qty - 0.5) * 10) / 10) }))}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={returnQtyInputs?.[item.product!] ?? qty}
                            onChange={e => {
                              const raw = e.target.value.replace(',', '.')
                              setReturnQtyInputs(p => ({ ...p, [item.product!]: raw }))
                              const val = parseFloat(raw)
                              if (!isNaN(val)) {
                                setReturnQtys(p => ({ ...p, [item.product!]: Math.min(maxQty, Math.max(0, val)) }))
                              }
                            }}
                            onBlur={() => {
                              setReturnQtyInputs(p => {
                                const next = { ...p }
                                delete next[item.product!]
                                return next
                              })
                            }}
                            className="w-16 text-center text-sm font-medium border rounded px-1 py-0.5"
                          />
                          <button
                            className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            onClick={() => setReturnQtys(p => ({ ...p, [item.product!]: Math.min(maxQty, Math.round((qty + 0.5) * 10) / 10) }))}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {qty > 0 && (
                        <div className="text-xs text-orange-600 mt-1 text-right">
                          Qaytariladi: {formatPrice(qty * item.salePrice)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {Object.values(returnQtys).some(q => q > 0) && (
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-orange-600">Jami qaytariladi</div>
                  <div className="font-bold text-orange-700 text-lg">
                    {formatPrice(
                      returnSale.items.reduce((s, item) => {
                        if (!item.product) return s
                        return s + (returnQtys[item.product] || 0) * item.salePrice
                      }, 0)
                    )}
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleReturn}
                disabled={returnLoading || !Object.values(returnQtys).some(q => q > 0)}
              >
                {returnLoading ? 'Qaytarilmoqda...' : 'Qaytarish'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
