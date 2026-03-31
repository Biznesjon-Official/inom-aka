'use client'
import React, { useState, useCallback, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Search, RefreshCw, Undo2, Printer, Minus, Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice, calcSaleRevenue, calcSaleProfit, calcSaleDebt, PAYMENT_STATUS, PAYMENT_METHODS } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks'
import { printReceipt } from '@/lib/print'

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
  payments?: { method: string; amount: number }[]
  customer?: { name: string; phone?: string }
  cashier?: { name: string; role?: string }
  usta?: { name: string }
  items: SaleItem[]
  returnedItems?: { product: string; productName: string; qty: number; salePrice: number; costPrice?: number }[]
  returnedTotal?: number
  createdAt: string
}

function SotuvlarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  
  const [shopSettings, setShopSettings] = useState<{ shopName?: string; shopPhone?: string; receiptFooter?: string }>({})
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [expandedSale, setExpandedSale] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table')

  // Return state
  const [returnDialog, setReturnDialog] = useState(false)
  const [returnSale, setReturnSale] = useState<Sale | null>(null)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [returnQtyInputs, setReturnQtyInputs] = useState<Record<string, string>>({})
  const [returnLoading, setReturnLoading] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(setShopSettings).catch(() => {})
  }, [])

  const debouncedSearch = useDebounce(search)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    
    if (selectedDate) {
      // Tanlangan kun boshi va oxiri
      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      params.set('from', startOfDay.toISOString())
      params.set('to', endOfDay.toISOString())
    } else {
      // Agar sana tanlanmagan bo'lsa, bugungi sotuvlar
      params.set('today', '1')
    }
    
    const res = await fetch(`/api/sales?${params}`)
    if (res.ok) {
      setSales(await res.json())
    } else {
      toast.error('Sotuvlarni yuklashda xato')
    }
    setLoading(false)
  }, [selectedDate])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSales() }, [fetchSales])

  // Auto-expand and scroll to highlighted sale
  useEffect(() => {
    if (highlightId && sales.length > 0) {
      const sale = sales.find(s => s._id === highlightId)
      if (sale) {
        setExpandedSale(highlightId)
        // Scroll to element after a short delay to ensure rendering
        setTimeout(() => {
          const element = document.querySelector(`[data-sale-id="${highlightId}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
      }
    }
  }, [highlightId, sales])
  // Filter by search (receipt#, customer name, cashier name)
  const filtered = sales.filter(s => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return (
      String(s.receiptNo).includes(q) ||
      (s.customer?.name || '').toLowerCase().includes(q) ||
      (s.cashier?.name || '').toLowerCase().includes(q)
    )
  })

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
    router.refresh()
  }

  const totalRevenue = filtered.reduce((s, x) => s + calcSaleRevenue(x), 0)
  const totalDebt = filtered.reduce((s, x) => s + calcSaleDebt(x), 0)
  const totalSales = filtered.reduce((s, x) => s + x.total - (x.returnedTotal || 0), 0)
  const totalProfit = filtered.reduce((s, x) => s + calcSaleProfit(x), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Sotuvlar</h1>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button className={`p-1.5 ${viewMode === 'list' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('list')}>
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchSales} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Chek #, mijoz yoki kassir..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            className="w-44" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            placeholder="Sana tanlang"
          />
          {selectedDate && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDate('')}
              className="whitespace-nowrap"
            >
              Bugun
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-slate-600 flex-wrap items-center">
        {selectedDate && (
          <span className="font-medium text-blue-600">
            📅 {new Date(selectedDate).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
        )}
        {!selectedDate && <span className="font-medium text-blue-600">📅 Bugun</span>}
        <span className="text-slate-300">|</span>
        <span>{filtered.length} ta sotuv</span>
        <span>Jami: <span className="font-bold text-slate-800">{formatPrice(totalSales)}</span></span>
        <span>Kirim: <span className="font-bold text-green-700">{formatPrice(totalRevenue)}</span></span>
        <span>Foyda: <span className="font-bold text-emerald-700">{formatPrice(totalProfit)}</span></span>
        {totalDebt > 0 && (
          <span>Qarz: <span className="font-bold text-orange-600">{formatPrice(totalDebt)}</span></span>
        )}
      </div>

      {/* Sales list */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Chek #</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Kassir</th>
                <th className="px-4 py-3 font-medium">Usta</th>
                <th className="px-4 py-3 font-medium">Mijoz</th>
                <th className="px-4 py-3 font-medium">To&apos;lov</th>
                <th className="px-4 py-3 font-medium text-right">Jami</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => {
                const isHighlighted = highlightId === sale._id
                return (
                <React.Fragment key={sale._id}>
                <tr 
                  data-sale-id={sale._id}
                  className={`border-b last:border-0 hover:bg-slate-50 cursor-pointer ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
                  onClick={() => setExpandedSale(expandedSale === sale._id ? null : sale._id)}>
                  <td className="px-4 py-3 font-medium text-slate-700">#{sale.receiptNo}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(sale.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{sale.cashier?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{sale.usta?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{sale.customer?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.variant || 'default'} className="text-xs">
                      {PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.label || sale.paymentType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold text-slate-800">{formatPrice(sale.total)}</div>
                    {(sale.returnedTotal || 0) > 0 && (
                      <div className="text-xs text-orange-500">-{formatPrice(sale.returnedTotal!)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button className="p-1 hover:bg-orange-50 rounded" title="Qaytarish" onClick={() => openReturn(sale)}>
                        <Undo2 className="w-3.5 h-3.5 text-orange-400" />
                      </button>
                      <button className="p-1 hover:bg-blue-50 rounded" title="Chop etish"
                        onClick={() => printReceipt({ receiptNo: sale.receiptNo, items: sale.items, total: sale.total, paid: sale.paid, cashier: sale.cashier?.name || 'Kassir', customer: sale.customer?.name, paymentType: sale.paymentType, createdAt: new Date(sale.createdAt), shopName: shopSettings.shopName, shopPhone: shopSettings.shopPhone, receiptFooter: shopSettings.receiptFooter })}>
                        <Printer className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedSale === sale._id && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="space-y-1">
                        {sale.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-600">{item.productName} x{item.qty} {item.unit}</span>
                            <span className="text-slate-700 font-medium">{formatPrice(item.salePrice * item.qty)}</span>
                          </div>
                        ))}
                        {sale.returnedItems && sale.returnedItems.length > 0 && (
                          <div className="border-t pt-1 mt-1">
                            <div className="text-[10px] text-orange-500 font-medium mb-0.5">Qaytarilgan:</div>
                            {sale.returnedItems.map((ri, i) => (
                              <div key={i} className="flex justify-between text-xs text-orange-500">
                                <span>{ri.productName} x{ri.qty}</span>
                                <span>-{formatPrice(ri.salePrice * ri.qty)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )})}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center text-slate-400 py-12">Sotuv topilmadi</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sale => {
            const isHighlighted = highlightId === sale._id
            return (
            <Card 
              key={sale._id} 
              data-sale-id={sale._id}
              className={`border-0 shadow-sm ${isHighlighted ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedSale(expandedSale === sale._id ? null : sale._id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium text-slate-700">#{sale.receiptNo}</span>
                      <span className="text-slate-400 ml-2">
                        {new Date(sale.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sale.cashier && (
                      <span className="text-xs text-slate-500">{sale.cashier.name}</span>
                    )}
                    <Badge variant={PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.variant || 'default'} className="text-xs">
                      {PAYMENT_STATUS[sale.paymentType as keyof typeof PAYMENT_STATUS]?.label || sale.paymentType}
                    </Badge>
                    <span className="font-bold text-sm text-slate-800">{formatPrice(sale.total)}</span>
                    <button className="p-1 hover:bg-orange-50 rounded" title="Qaytarish"
                      onClick={e => { e.stopPropagation(); openReturn(sale) }}>
                      <Undo2 className="w-3.5 h-3.5 text-orange-400" />
                    </button>
                    <button className="p-1 hover:bg-blue-50 rounded" title="Chop etish"
                      onClick={e => {
                        e.stopPropagation()
                        printReceipt({ receiptNo: sale.receiptNo, items: sale.items, total: sale.total, paid: sale.paid, cashier: sale.cashier?.name || 'Kassir', customer: sale.customer?.name, paymentType: sale.paymentType, createdAt: new Date(sale.createdAt), shopName: shopSettings.shopName, shopPhone: shopSettings.shopPhone, receiptFooter: shopSettings.receiptFooter })
                      }}>
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                  </div>
                </div>

                {sale.customer && (
                  <div className="text-xs text-slate-500 mt-1">
                    Mijoz: {sale.customer.name} {sale.customer.phone && `(${sale.customer.phone})`}
                  </div>
                )}

                {sale.usta && (
                  <div className="text-xs text-slate-500 mt-1">
                    Usta: {sale.usta.name}
                  </div>
                )}

                {(sale.returnedTotal || 0) > 0 && (
                  <div className="text-xs text-orange-500 mt-1">
                    Qaytarilgan: {formatPrice(sale.returnedTotal!)}
                  </div>
                )}

                {sale.payments && sale.payments.length > 0 && (
                  <div className="flex gap-2 mt-1">
                    {sale.payments.map((p, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method}: {formatPrice(p.amount)}
                      </span>
                    ))}
                  </div>
                )}

                {expandedSale === sale._id && (
                  <div className="mt-3 border-t pt-2 space-y-1">
                    {sale.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-600">{item.productName} x{item.qty} {item.unit}</span>
                        <span className="text-slate-700 font-medium">{formatPrice(item.salePrice * item.qty)}</span>
                      </div>
                    ))}
                    {sale.returnedItems && sale.returnedItems.length > 0 && (
                      <div className="border-t pt-1 mt-1">
                        <div className="text-[10px] text-orange-500 font-medium mb-0.5">Qaytarilgan:</div>
                        {sale.returnedItems.map((ri, i) => (
                          <div key={i} className="flex justify-between text-xs text-orange-500">
                            <span>{ri.productName} x{ri.qty}</span>
                            <span>-{formatPrice(ri.salePrice * ri.qty)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )})}
          {!loading && filtered.length === 0 && (
            <div className="text-center text-slate-400 py-12">Sotuv topilmadi</div>
          )}
        </div>
      )}

      {/* Return dialog */}
      <Dialog open={returnDialog} onOpenChange={setReturnDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tovar qaytarish {returnSale?.receiptNo && `#${returnSale.receiptNo}`}</DialogTitle>
          </DialogHeader>
          {returnSale && (() => {
            const originalTotal = returnSale.items.reduce((s, i) => s + i.qty * i.salePrice, 0)
            const discountRatio = originalTotal > 0 ? returnSale.total / originalTotal : 1
            const effectivePrice = (item: SaleItem) => Math.round(item.salePrice * discountRatio)
            return (
            <div className="space-y-3">
              {discountRatio < 1 && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                  Chegirma qo&apos;llanilgan ({Math.round((1 - discountRatio) * 100)}%)
                </div>
              )}
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
                  const effPrice = effectivePrice(item)
                  return (
                    <div key={item.product} className="p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.productName}</div>
                          <div className="text-xs text-slate-500">
                            {formatPrice(effPrice)} x {item.qty} {item.unit}
                            {discountRatio < 1 && <span className="line-through ml-1 text-slate-400">{formatPrice(item.salePrice)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            onClick={() => setReturnQtys(p => ({ ...p, [item.product!]: Math.max(0, Math.round((qty - 0.5) * 10) / 10) }))}>
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
                          <button className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            onClick={() => setReturnQtys(p => ({ ...p, [item.product!]: Math.min(maxQty, Math.round((qty + 0.5) * 10) / 10) }))}>
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {qty > 0 && (
                        <div className="text-xs text-orange-600 mt-1 text-right">
                          Qaytariladi: {formatPrice(qty * effPrice)}
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
                        return s + (returnQtys[item.product] || 0) * effectivePrice(item)
                      }, 0)
                    )}
                  </div>
                </div>
              )}
              <Button className="w-full" variant="destructive" onClick={handleReturn}
                disabled={returnLoading || !Object.values(returnQtys).some(q => q > 0)}>
                {returnLoading ? 'Qaytarilmoqda...' : 'Qaytarish'}
              </Button>
            </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function SotuvlarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16">Yuklanmoqda...</div>}>
      <SotuvlarContent />
    </Suspense>
  )
}
