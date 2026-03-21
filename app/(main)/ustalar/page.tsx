'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Users, Phone, Percent, Gift, Banknote, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice, getMonthRange, getYearRange } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks'

interface Usta {
  _id: string; name: string; phone?: string; address?: string; note?: string; totalDebt: number; cashbackPercent: number
  cashbackStartDate?: string; cashbackEndDate?: string
}

interface CashbackData {
  totalSales: number; percent: number; calculatedAmount: number; alreadyPaid: number; remaining: number
  payouts: { _id: string; amount: number; type: string; note?: string; createdAt: string; periodFrom: string; periodTo: string; percent: number }[]
}

interface UstaSale {
  _id: string
  receiptNo: number
  total: number
  paid: number
  paymentType: string
  items: { productName: string; qty: number; salePrice: number; unit: string }[]
  cashier?: { name: string }
  createdAt: string
}

const emptyForm = { name: '', phone: '', address: '', note: '', cashbackPercent: 0, cashbackStartDate: '', cashbackEndDate: '' }

export default function UstalarPage() {
  const [ustalar, setUstalar] = useState<Usta[]>([])
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Usta | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  // Detail dialog state
  const [detailUsta, setDetailUsta] = useState<Usta | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [cashbackData, setCashbackData] = useState<CashbackData | null>(null)
  const [cashbackLoading, setCashbackLoading] = useState(false)

  // Usta sales
  const [ustaSales, setUstaSales] = useState<UstaSale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [closingPeriod, setClosingPeriod] = useState(false)

  const debouncedSearch = useDebounce(search)
  const fetchUstalar = useCallback(async () => {
    const res = await fetch(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`)
    if (!res.ok) return toast.error('Ustalarni yuklashda xato')
    setUstalar(await res.json())
  }, [debouncedSearch])

  useEffect(() => { fetchUstalar() }, [fetchUstalar])

  // Fetch cashback data when detail dialog opens or period changes
  const fetchCashback = useCallback(async () => {
    if (!detailUsta) return
    setCashbackLoading(true)
    const from = detailUsta.cashbackStartDate ? new Date(detailUsta.cashbackStartDate).toISOString() : new Date('2000-01-01').toISOString()
    const to = detailUsta.cashbackEndDate ? new Date(detailUsta.cashbackEndDate).toISOString() : new Date('2100-01-01').toISOString()
    const res = await fetch(`/api/customers/${detailUsta._id}/cashback?from=${from}&to=${to}`)
    if (!res.ok) { setCashbackLoading(false); return toast.error('Cashback ma\'lumotlarini yuklashda xato') }
    setCashbackData(await res.json())
    setCashbackLoading(false)
  }, [detailUsta])

  const fetchUstaSales = useCallback(async () => {
    if (!detailUsta) return
    setSalesLoading(true)
    const from = detailUsta.cashbackStartDate ? new Date(detailUsta.cashbackStartDate).toISOString() : ''
    const to = detailUsta.cashbackEndDate ? new Date(detailUsta.cashbackEndDate).toISOString() : ''
    
    // Add time filters if dates exist
    const qs = from && to ? `&from=${from}&to=${to}` : ''
    const res = await fetch(`/api/sales?usta=${detailUsta._id}${qs}`)
    if (res.ok) {
      setUstaSales(await res.json())
    }
    setSalesLoading(false)
  }, [detailUsta])

  useEffect(() => {
    if (detailOpen) {
      fetchCashback()
      fetchUstaSales()
    }
  }, [detailOpen, fetchCashback, fetchUstaSales])

  function openAdd() { setEditing(null); setForm(emptyForm); setDialog(true) }
  function openEdit(e: React.MouseEvent, c: Usta) {
    e.stopPropagation()
    setEditing(c)
    setForm({ 
      name: c.name, 
      phone: c.phone || '', 
      address: c.address || '', 
      note: c.note || '', 
      cashbackPercent: c.cashbackPercent || 0,
      cashbackStartDate: c.cashbackStartDate ? new Date(c.cashbackStartDate).toISOString().split('T')[0] : '',
      cashbackEndDate: c.cashbackEndDate ? new Date(c.cashbackEndDate).toISOString().split('T')[0] : ''
    })
    setDialog(true)
  }

  function openDetail(c: Usta) {
    setDetailUsta(c)
    setCashbackData(null)
    setUstaSales([])
    setDetailOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Ism majburiy')
    setLoading(true)
    const url = editing ? `/api/customers/${editing._id}` : '/api/customers'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setLoading(false)
    if (!res.ok) return toast.error('Xato')
    toast.success(editing ? 'Yangilandi' : 'Qo\'shildi')
    setDialog(false)
    fetchUstalar()
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    toast.success('O\'chirildi')
    fetchUstalar()
  }

  async function handleClosePeriod() {
    if (!detailUsta || !cashbackData) return
    if (!confirm('Davrni yopishni va to\'plamcha qilishni tasdiqlaysizmi? Hozirgi hisoblangan barcha summa arxivga ketadi.')) return

    setClosingPeriod(true)
    const from = detailUsta.cashbackStartDate ? new Date(detailUsta.cashbackStartDate).toISOString() : new Date('2000-01-01').toISOString()
    const to = detailUsta.cashbackEndDate ? new Date(detailUsta.cashbackEndDate).toISOString() : new Date().toISOString()
    
    // Create archive payout
    const payoutRes = await fetch(`/api/customers/${detailUsta._id}/cashback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: cashbackData.calculatedAmount,
        periodFrom: from,
        periodTo: to,
        totalSales: cashbackData.totalSales,
        percent: cashbackData.percent,
        type: 'archive',
        note: `Davr oxiri (Arxivlandi)`,
      }),
    })
    if (!payoutRes.ok) { setClosingPeriod(false); return toast.error('Arxivlashda xato') }

    // Update customer dates: new start = old end (or today), new end = start + 1 year
    const newStart = new Date(to) // already ISO
    const newEnd = new Date(to)
    newEnd.setFullYear(newEnd.getFullYear() + 1)

    const updateRes = await fetch(`/api/customers/${detailUsta._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cashbackStartDate: newStart.toISOString(),
        cashbackEndDate: newEnd.toISOString()
      }),
    })

    setClosingPeriod(false)
    if (!updateRes.ok) return toast.error('Mijozni yangilashda xato, arxiv saqlandi.')
    
    toast.success('Davr yopildi, yangi davr boshlandi')
    fetchUstalar()
    
    // Refresh local detailUsta to trigger re-fetches
    const updatedCustomer = await updateRes.json()
    setDetailUsta(updatedCustomer)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Ustalar</h1>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Usta qo&apos;shish</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Usta ismi yoki telefon qidirish..." className="pl-9" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Ism</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">Manzil</th>
                <th className="px-4 py-3 font-medium text-right">Qarz</th>
                <th className="px-4 py-3 font-medium text-right">Foyiz %</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {ustalar.map(c => (
                <tr key={c._id} className="border-b last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{c.address || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {c.totalDebt > 0 ? (
                      <span className="text-red-600 font-medium">{formatPrice(c.totalDebt)}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {c.cashbackPercent > 0 ? `${c.cashbackPercent}%` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="p-1 hover:bg-slate-100 rounded" onClick={(e) => openEdit(e, c)}>
                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button className="p-1 hover:bg-red-50 rounded" onClick={(e) => handleDelete(e, c._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ustalar.length === 0 && (
            <div className="text-center text-slate-400 py-12">Usta topilmadi</div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ustalar.map(c => (
            <Card key={c._id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(c)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{c.name}</div>
                      {c.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                          <Phone className="w-3 h-3" />{c.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-1 hover:bg-slate-100 rounded" onClick={(e) => openEdit(e, c)}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button className="p-1 hover:bg-red-50 rounded" onClick={(e) => handleDelete(e, c._id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                {c.address && <div className="text-xs text-slate-500 mt-2">{c.address}</div>}
                {c.note && <div className="text-xs text-slate-400 mt-1 italic">{c.note}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.totalDebt > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      Qarz: {formatPrice(c.totalDebt)}
                    </Badge>
                  )}
                  {c.cashbackPercent > 0 && (
                    <Badge className="text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Foyiz: {c.cashbackPercent}%
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {ustalar.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-12">Usta topilmadi</div>
          )}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Tahrirlash' : 'Yangi usta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+998 XX XXX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Manzil</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Foyiz (cashback) %</Label>
              <Input type="number" min={0} max={100} step={0.5} value={form.cashbackPercent}
                onChange={e => setForm(f => ({ ...f, cashbackPercent: Number(e.target.value) }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Boshlanish (ixtiyoriy)</Label>
                <Input type="date" value={form.cashbackStartDate} onChange={e => setForm(f => ({ ...f, cashbackStartDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Qachongacha hisoblanadi?</Label>
                <Input type="date" value={form.cashbackEndDate} onChange={e => setForm(f => ({ ...f, cashbackEndDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {detailUsta?.name}
            </DialogTitle>
          </DialogHeader>

          {detailUsta && (
            <div className="space-y-4">
              {/* Usta sales history */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Savdo tarixi ({ustaSales.length})</div>
                {salesLoading ? (
                  <div className="text-center text-slate-400 py-4 text-sm">Yuklanmoqda...</div>
                ) : ustaSales.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {ustaSales.map(sale => (
                      <div key={sale._id} className="bg-slate-50 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-700">
                              {new Date(sale.createdAt).toLocaleDateString('uz-UZ')}
                            </span>
                            <span className="text-slate-400">#{sale.receiptNo}</span>
                          </div>
                          <Badge variant={sale.paymentType === 'full' ? 'default' : sale.paymentType === 'partial' ? 'secondary' : 'destructive'} className="text-[10px] h-4">
                            {sale.paymentType === 'full' ? 'To\'liq' : sale.paymentType === 'partial' ? 'Qisman' : 'Qarz'}
                          </Badge>
                        </div>
                        <div className="text-slate-500 mb-1">
                          {sale.items.map(i => `${i.productName} x${i.qty}`).join(', ')}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{sale.cashier?.name || ''}</span>
                          <span className="font-bold text-slate-800">{formatPrice(sale.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-4 text-sm">Savdo yo&apos;q</div>
                )}
              </div>

            {/* Cashback section */}
              {detailUsta.cashbackPercent > 0 && (
                <>
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium text-slate-700 mb-2">Foyiz hisobi</div>
                    <div className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 rounded">
                      Davr: {detailUsta.cashbackStartDate ? new Date(detailUsta.cashbackStartDate).toLocaleDateString('uz-UZ') : 'Noma\'lum'} dan{' '}
                      {detailUsta.cashbackEndDate ? new Date(detailUsta.cashbackEndDate).toLocaleDateString('uz-UZ') : 'Noma\'lum'} gacha
                      <br/>
                      Ushbu sanalar ichida ishlangan sotuvlardan hisoblanadi. Shartnoma yakunlanganda siz uni "Davrni yopish" orqali arxivlashingiz va yangi sanadan hisob kitobni boshlashingiz mumkin.
                    </div>

                    {cashbackLoading ? (
                      <div className="text-center text-slate-400 py-4">Yuklanmoqda...</div>
                    ) : cashbackData ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-xs text-slate-500">Jami xaridlar</div>
                            <div className="font-semibold text-slate-800 mt-0.5">{formatPrice(cashbackData.totalSales)}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="text-xs text-slate-500">Foiz stavkasi</div>
                            <div className="font-semibold text-slate-800 mt-0.5">{cashbackData.percent}%</div>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <div className="text-xs text-emerald-600">Hisoblangan foyiz</div>
                            <div className="font-semibold text-emerald-700 mt-0.5">{formatPrice(cashbackData.calculatedAmount)}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs text-blue-600">To&apos;langan</div>
                            <div className="font-semibold text-blue-700 mt-0.5">{formatPrice(cashbackData.alreadyPaid)}</div>
                          </div>
                        </div>

                        <div className="border rounded-lg p-4 space-y-3 mt-4">
                          <div className="text-sm font-medium text-slate-700">Shartnomani yakunlash</div>
                          <div className="text-xs text-slate-500">
                            "Davrni yopish" tugmasi hozirgi hisoblangan {formatPrice(cashbackData.calculatedAmount)} summani arxivga oladi. 
                            So'ng, qaytadan keyingi 1 yil uchun hisoblash boshlanadi. Davr yakunlangandan keyin usta pulini "Xarajatlar" sahifasida berasiz.
                          </div>
                          <Button size="sm" className="w-full" onClick={handleClosePeriod} disabled={closingPeriod}>
                            {closingPeriod ? 'Arxivlanmoqda...' : 'Davrni yopish va arxivlash'}
                          </Button>
                        </div>

                        {cashbackData.payouts.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <div className="text-sm font-medium text-slate-700">Arxivlangan davrlar</div>
                            {cashbackData.payouts.map(p => (
                              <div key={p._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                                <div>
                                  <div className="text-sm font-medium text-slate-700">{formatPrice(p.amount)} <span className="text-xs font-normal text-slate-500">({p.percent}%)</span></div>
                                  <div className="text-xs text-slate-500">
                                    Davr: {new Date(p.periodFrom).toLocaleDateString()} — {new Date(p.periodTo).toLocaleDateString()}
                                  </div>
                                </div>
                                <Badge className={p.type === 'archive' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-200 text-slate-700 hover:bg-slate-200'}>
                                  Arxiv
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
