'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPrice } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Sale {
  _id: string
  total: number
  paid: number
  paymentType: string
  customer?: { name: string }
  cashier?: { name: string }
  items: { productName: string; qty: number; salePrice: number; unit: string }[]
  createdAt: string
}

const payBadge = {
  full: { label: "To'liq", variant: 'default' as const },
  partial: { label: 'Qisman', variant: 'secondary' as const },
  debt: { label: 'Qarz', variant: 'destructive' as const },
}

export default function SalesLog({ cashierId }: { cashierId?: string }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [debtPayments, setDebtPayments] = useState<{ _id: string; totalAmount: number; paidAmount: number; customer?: { name: string }; updatedAt: string }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ today: '1' })
    if (cashierId) params.set('cashier', cashierId)
    const [salesRes, debtsRes] = await Promise.all([
      fetch(`/api/sales?${params}`),
      cashierId ? Promise.resolve({ json: () => [] }) : fetch('/api/debts?status=paid&limit=20'),
    ])
    const salesData = await salesRes.json()
    const debtsData = typeof debtsRes.json === 'function' ? await debtsRes.json() : []
    setSales(Array.isArray(salesData) ? salesData : [])
    setDebtPayments(Array.isArray(debtsData) ? debtsData : [])
    setLoading(false)
  }, [cashierId])

  useEffect(() => { fetchSales() }, [fetchSales])

  const todayRevenue = sales.reduce((s, x) => s + x.paid, 0)
  const todayTotal = sales.reduce((s, x) => s + x.total, 0)

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Bugungi savdolar</CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchSales} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span>{sales.length} ta sotuv</span>
          <span>Kirim: <span className="font-medium text-slate-700">{formatPrice(todayRevenue)}</span></span>
          {todayTotal > todayRevenue && (
            <span>Qarz: <span className="font-medium text-orange-600">{formatPrice(todayTotal - todayRevenue)}</span></span>
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
                    <span className="font-medium">{new Date(sale.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                    <Badge variant={payBadge[sale.paymentType as keyof typeof payBadge]?.variant} className="text-xs h-4">
                      {payBadge[sale.paymentType as keyof typeof payBadge]?.label}
                    </Badge>
                  </div>
                  {sale.customer && <div className="text-slate-500">{sale.customer.name}</div>}
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">{sale.items.length} ta mahsulot</span>
                    <span className="font-bold text-slate-800">{formatPrice(sale.total)}</span>
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
                    <div className="flex justify-between">
                      <span className="font-medium">{d.customer?.name}</span>
                      <span className="font-bold text-green-600">{formatPrice(d.paidAmount)}</span>
                    </div>
                  </div>
                ))}
                {debtPayments.length === 0 && (
                  <div className="text-center text-slate-400 py-4">Qarz to&apos;lovi yo&apos;q</div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}
