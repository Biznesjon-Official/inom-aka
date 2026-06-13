'use client'
import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Search, RefreshCw, Undo2, Printer, Minus, Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice, calcSaleRevenue, calcSaleProfit, calcSaleDebt, PAYMENT_STATUS, PAYMENT_METHODS } from '@/lib/utils'
import { useDebounce, getSettings } from '@/lib/hooks'
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
  payments?: { method: string; amount: number; date: string }[]
  customer?: { name: string; phone?: string }
  cashier?: { name: string; role?: string }
  usta?: { name: string }
  items: SaleItem[]
  returnedItems?: { product: string; productName: string; qty: number; salePrice: number; costPrice?: number }[]
  returnedTotal?: number
  createdAt: string
}

const PAGE_SIZE = 30

interface SalesStats {
  totalRevenue: number
  totalDebt: number
  totalSales: number
  totalProfit: number
  count: number
}

function SotuvlarContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const highlightId = searchParams.get('highlight')
  const idsParam = searchParams.get('ids')
  const idsMode = !!(idsParam && idsParam.length > 0)
  const isAdmin = session?.user?.role === 'admin'

  const [shopSettings, setShopSettings] = useState<{ shopName?: string; shopPhone?: string; receiptFooter?: string; qrEnabled?: boolean; qrText?: string }>({})
  const [sales, setSales] = useState<Sale[]>([])
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pageRef = useRef(1)
  const fetchSeqRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [activePreset, setActivePreset] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [expandedSale, setExpandedSale] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table')

  // Return state
  const [returnDialog, setReturnDialog] = useState(false)
  const [returnSale, setReturnSale] = useState<Sale | null>(null)
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({})
  const [returnQtyInputs, setReturnQtyInputs] = useState<Record<string, string>>({})
  const [returnLoading, setReturnLoading] = useState(false)

  useEffect(() => {
    getSettings<{ shopName?: string; shopPhone?: string; receiptFooter?: string; qrEnabled?: boolean; qrText?: string }>().then(setShopSettings)
  }, [])

  const debouncedSearch = useDebounce(search)

  function getPresetDates(key: typeof activePreset): { from: string; to: string } {
    const now = new Date()
    const fmt = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    switch (key) {
      case 'today': return { from: fmt(now), to: fmt(now) }
      case 'week': {
        const start = new Date(now)
        const day = now.getDay()
        start.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
        return { from: fmt(start), to: fmt(now) }
      }
      case 'month': return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) }
      case 'year': return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) }
      default: return { from: fmt(now), to: fmt(now) }
    }
  }

  const handlePreset = (key: typeof activePreset) => {
    setActivePreset(key)
    if (key !== 'custom') {
      const { from, to } = getPresetDates(key)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  // Shared query params for list and stats — keeps both in sync
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    } else if (dateFrom && dateTo) {
      const startOfDay = new Date(dateFrom)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      params.set('from', startOfDay.toISOString())
      params.set('to', endOfDay.toISOString())
    }
    return params
  }, [debouncedSearch, dateFrom, dateTo])

  const fetchStats = useCallback(async () => {
    if (!isAdmin || idsMode) return
    const params = buildParams()
    params.set('stats', '1')
    const res = await fetch(`/api/sales?${params}`)
    if (res.ok) setStats(await res.json())
  }, [isAdmin, idsMode, buildParams])

  const fetchPage = useCallback(async (page: number, reset: boolean) => {
    if (idsMode) return  // ids mode uses separate fetch
    const seq = reset ? ++fetchSeqRef.current : fetchSeqRef.current
    if (reset) setLoading(true)
    else { loadingMoreRef.current = true; setLoadingMore(true) }
    try {
      const params = buildParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(`/api/sales?${params}`)
      if (!res.ok) return toast.error('Sotuvlarni yuklashda xato')
      const data = await res.json()
      if (seq !== fetchSeqRef.current) return // filter changed mid-flight — drop stale response
      setSales(prev => {
        if (reset) return data.items
        const seen = new Set(prev.map((s: Sale) => s._id))
        return [...prev, ...data.items.filter((s: Sale) => !seen.has(s._id))]
      })
      setHasMore(data.hasMore)
      pageRef.current = page
    } catch {
      toast.error('Tarmoq xatosi')
    } finally {
      if (seq === fetchSeqRef.current) { setLoading(false); loadingMoreRef.current = false; setLoadingMore(false) }
    }
  }, [idsMode, buildParams])

  const refreshAll = useCallback(() => { fetchPage(1, true); fetchStats() }, [fetchPage, fetchStats])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activePreset !== 'custom') {
      const { from, to } = getPresetDates(activePreset)
      setDateFrom(from)
      setDateTo(to)
    }
  }, [activePreset])

  useEffect(() => { fetchStats() }, [fetchStats])

  // Filter/search change resets pagination to page 1
  useEffect(() => {
    if (idsMode) return
    setSales([]); setHasMore(true); fetchPage(1, true)
  }, [fetchPage, idsMode])

  // Infinite scroll: load next page when sentinel becomes visible
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loadingMoreRef.current) fetchPage(pageRef.current + 1, false)
    }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [fetchPage, hasMore, loading, viewMode])

  // ids mode: fetch specific sales
  useEffect(() => {
    if (!idsMode || !idsParam) return
    setLoading(true)
    fetch(`/api/sales?ids=${idsParam}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setSales(data); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam])

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
  // When search active, server already filtered; otherwise client-side filter for cashier name
  const filtered = debouncedSearch ? sales : sales

  function getPaymentType(sale: Sale): keyof typeof PAYMENT_STATUS {
    const remaining = Math.max(0, sale.total - sale.paid - (sale.returnedTotal || 0))
    if (remaining <= 0.01) return 'full'
    if (sale.paid > 0.01) return 'partial'
    return 'debt'
  }

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
    refreshAll()
    router.refresh()
  }

  // ids mode has no server stats — compute from the (small) loaded list
  const totalRevenue = idsMode ? filtered.reduce((s, x) => s + calcSaleRevenue(x), 0) : (stats?.totalRevenue || 0)
  const totalDebt = idsMode ? filtered.reduce((s, x) => s + calcSaleDebt(x), 0) : (stats?.totalDebt || 0)
  const totalSales = idsMode ? filtered.reduce((s, x) => s + x.total - (x.returnedTotal || 0), 0) : (stats?.totalSales || 0)
  const totalProfit = idsMode ? filtered.reduce((s, x) => s + calcSaleProfit(x), 0) : (stats?.totalProfit || 0)
  const salesCount = idsMode ? filtered.length : (stats?.count ?? 0)

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
          <Button variant="ghost" size="sm" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Yangilash
          </Button>
        </div>
      </div>

      {/* ids mode banner */}
      {idsMode && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
          <span className="text-sm text-orange-700 font-medium">Arxivdagi qarzdorning sotuvlari ko&apos;rsatilmoqda</span>
          <Button variant="outline" size="sm" onClick={() => router.back()}>Orqaga</Button>
        </div>
      )}

      {/* Filters */}
      {!idsMode && (
      <>
      {/* Date filter buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'today' as const, label: 'Bugun' },
          { key: 'week' as const, label: 'Hafta' },
          { key: 'month' as const, label: 'Oy' },
          { key: 'year' as const, label: 'Yil' },
          { key: 'custom' as const, label: 'Tanlash' },
        ].map(({ key, label }) => (
          <Button key={key} variant={activePreset === key ? 'default' : 'outline'} size="sm"
            onClick={() => handlePreset(key)}>
            {label}
          </Button>
        ))}
      </div>

      {/* Custom: bitta kunni tanlash */}
      {activePreset === 'custom' && (
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setDateTo(e.target.value) }} className="w-48" />
        </div>
      )}

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Chek #, mijoz yoki kassir..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      </>
      )}

      {/* Stats - faqat admin uchun */}
      {isAdmin && (
      <div className="space-y-2">
        <div className="flex gap-2 text-sm text-slate-600 flex-wrap items-center">
          {!idsMode && debouncedSearch && <span className="font-medium text-purple-600">Barcha vaqtlar</span>}
          {!idsMode && !debouncedSearch && activePreset === 'today' && <span className="font-medium text-blue-600">📅 Bugun</span>}
          {!idsMode && !debouncedSearch && activePreset === 'week' && <span className="font-medium text-blue-600">📅 Bu hafta</span>}
          {!idsMode && !debouncedSearch && activePreset === 'month' && <span className="font-medium text-blue-600">📅 Bu oy</span>}
          {!idsMode && !debouncedSearch && activePreset === 'year' && <span className="font-medium text-blue-600">📅 Bu yil</span>}
          {!idsMode && !debouncedSearch && activePreset === 'custom' && dateFrom && (
            <span className="font-medium text-blue-600">
              📅 {new Date(dateFrom).toLocaleDateString('uz-UZ')}
            </span>
          )}
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="w-full sm:w-auto">{salesCount} ta sotuv</span>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-4 text-sm text-slate-600">
          <span>Jami: <span className="font-bold text-slate-800 block sm:inline">{formatPrice(totalSales)}</span></span>
          <span>Kirim: <span className="font-bold text-green-700 block sm:inline">{formatPrice(totalRevenue)}</span></span>
          <span>Foyda: <span className="font-bold text-emerald-700 block sm:inline">{formatPrice(totalProfit)}</span></span>
          {totalDebt > 0 && (
            <span>Qarz: <span className="font-bold text-orange-600 block sm:inline">{formatPrice(totalDebt)}</span></span>
          )}
        </div>
      </div>
      )}

      {/* Sales list */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm border">
          <div className="min-w-[800px]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-300">
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Chek #</th>
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Sana</th>
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Kassir</th>
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Usta</th>
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">Mijoz</th>
                <th className="px-4 py-3 font-semibold text-slate-700 border-r border-slate-200">To&apos;lov</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right border-r border-slate-200">Jami</th>
                <th className="px-4 py-3 font-semibold text-slate-700 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sale => {
                const isHighlighted = highlightId === sale._id
                return (
                <React.Fragment key={sale._id}>
                <tr 
                  data-sale-id={sale._id}
                  className={`border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${isHighlighted ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
                  onClick={() => !idsMode && setExpandedSale(expandedSale === sale._id ? null : sale._id)}>
                  <td className="px-4 py-3 font-medium text-slate-700 border-r border-slate-200">#{sale.receiptNo}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap border-r border-slate-200">
                    {new Date(sale.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">{sale.cashier?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">{sale.usta?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 border-r border-slate-200">{sale.customer?.name || '—'}</td>
                  <td className="px-4 py-3 border-r border-slate-200">
                    <Badge variant={PAYMENT_STATUS[getPaymentType(sale)].variant} className="text-xs">
                      {PAYMENT_STATUS[getPaymentType(sale)].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right border-r border-slate-200">
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
                        onClick={() => printReceipt({ receiptNo: sale.receiptNo, items: sale.items, total: sale.total, paid: sale.paid, cashier: sale.cashier?.name || 'Kassir', customer: sale.customer?.name, paymentType: sale.paymentType, createdAt: new Date(sale.createdAt), shopName: shopSettings.shopName, shopPhone: shopSettings.shopPhone, receiptFooter: shopSettings.receiptFooter, qrEnabled: shopSettings.qrEnabled, qrText: shopSettings.qrText })}>
                        <Printer className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                {(idsMode || expandedSale === sale._id) && (
                  <tr className="bg-slate-50 border-b border-slate-200">
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
                        {sale.payments && sale.payments.length > 0 && (
                          <div className="border-t pt-1 mt-1">
                            <div className="text-[10px] text-green-600 font-medium mb-0.5">To&apos;lovlar:</div>
                            {sale.payments.map((p, i) => (
                              <div key={i} className="flex justify-between text-xs text-green-700">
                                <span>
                                  {new Date(p.date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  {' · '}{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method}
                                </span>
                                <span className="font-medium">{formatPrice(p.amount)}</span>
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
          </div>
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
                  onClick={() => !idsMode && setExpandedSale(expandedSale === sale._id ? null : sale._id)}>
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
                    <Badge variant={PAYMENT_STATUS[getPaymentType(sale)].variant} className="text-xs">
                      {PAYMENT_STATUS[getPaymentType(sale)].label}
                    </Badge>
                    <span className="font-bold text-sm text-slate-800">{formatPrice(sale.total)}</span>
                    <button className="p-1 hover:bg-orange-50 rounded" title="Qaytarish"
                      onClick={e => { e.stopPropagation(); openReturn(sale) }}>
                      <Undo2 className="w-3.5 h-3.5 text-orange-400" />
                    </button>
                    <button className="p-1 hover:bg-blue-50 rounded" title="Chop etish"
                      onClick={e => {
                        e.stopPropagation()
                        printReceipt({ receiptNo: sale.receiptNo, items: sale.items, total: sale.total, paid: sale.paid, cashier: sale.cashier?.name || 'Kassir', customer: sale.customer?.name, paymentType: sale.paymentType, createdAt: new Date(sale.createdAt), shopName: shopSettings.shopName, shopPhone: shopSettings.shopPhone, receiptFooter: shopSettings.receiptFooter, qrEnabled: shopSettings.qrEnabled, qrText: shopSettings.qrText })
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

                {(idsMode || expandedSale === sale._id) && (
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
                    {sale.payments && sale.payments.length > 0 && (
                      <div className="border-t pt-1 mt-1">
                        <div className="text-[10px] text-green-600 font-medium mb-0.5">To&apos;lovlar:</div>
                        {sale.payments.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs text-green-700">
                            <span>
                              {new Date(p.date).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              {' · '}{PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] || p.method}
                            </span>
                            <span className="font-medium">{formatPrice(p.amount)}</span>
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

      {loading && <div className="text-center text-slate-400 py-4 text-sm">Yuklanmoqda...</div>}
      {!idsMode && hasMore && !loading && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && <div className="text-center text-slate-400 py-4 text-sm">Yuklanmoqda...</div>}

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
