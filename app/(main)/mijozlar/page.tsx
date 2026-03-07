'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Users, Phone, Percent, Gift, Banknote } from 'lucide-react'
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

interface Customer {
  _id: string; name: string; phone?: string; address?: string; note?: string; totalDebt: number; cashbackPercent: number
}

interface CashbackData {
  totalSales: number; percent: number; calculatedAmount: number; alreadyPaid: number; remaining: number
  payouts: { _id: string; amount: number; type: string; note?: string; createdAt: string }[]
}

const emptyForm = { name: '', phone: '', address: '', note: '', cashbackPercent: 0 }

export default function MijozlarPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  // Detail dialog state
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const [cashbackData, setCashbackData] = useState<CashbackData | null>(null)
  const [cashbackLoading, setCashbackLoading] = useState(false)

  // Payout form
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutType, setPayoutType] = useState<'money' | 'gift'>('money')
  const [payoutNote, setPayoutNote] = useState('')
  const [payoutLoading, setPayoutLoading] = useState(false)

  const debouncedSearch = useDebounce(search)
  const fetchCustomers = useCallback(async () => {
    const res = await fetch(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`)
    if (!res.ok) return toast.error('Mijozlarni yuklashda xato')
    setCustomers(await res.json())
  }, [debouncedSearch])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // Fetch cashback data when detail dialog opens or period changes
  const fetchCashback = useCallback(async () => {
    if (!detailCustomer) return
    setCashbackLoading(true)
    const range = period === 'month' ? getMonthRange() : getYearRange()
    const from = range.from.toISOString()
    const to = range.to.toISOString()
    const res = await fetch(`/api/customers/${detailCustomer._id}/cashback?from=${from}&to=${to}`)
    if (!res.ok) { setCashbackLoading(false); return toast.error('Cashback ma\'lumotlarini yuklashda xato') }
    setCashbackData(await res.json())
    setCashbackLoading(false)
  }, [detailCustomer, period])

  useEffect(() => {
    if (detailOpen) fetchCashback()
  }, [detailOpen, fetchCashback])

  function openAdd() { setEditing(null); setForm(emptyForm); setDialog(true) }
  function openEdit(e: React.MouseEvent, c: Customer) {
    e.stopPropagation()
    setEditing(c)
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', note: c.note || '', cashbackPercent: c.cashbackPercent || 0 })
    setDialog(true)
  }

  function openDetail(c: Customer) {
    setDetailCustomer(c)
    setPeriod('month')
    setCashbackData(null)
    setPayoutAmount('')
    setPayoutNote('')
    setPayoutType('money')
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
    fetchCustomers()
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    toast.success('O\'chirildi')
    fetchCustomers()
  }

  async function handlePayout() {
    if (!detailCustomer || !cashbackData) return
    const amount = Number(payoutAmount)
    if (!amount || amount <= 0) return toast.error('Summani kiriting')
    if (amount > cashbackData.remaining) return toast.error('Qoldiqdan ko\'p bo\'lishi mumkin emas')

    setPayoutLoading(true)
    const range = period === 'month' ? getMonthRange() : getYearRange()
    const res = await fetch(`/api/customers/${detailCustomer._id}/cashback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        periodFrom: range.from.toISOString(),
        periodTo: range.to.toISOString(),
        totalSales: cashbackData.totalSales,
        percent: cashbackData.percent,
        type: payoutType,
        note: payoutNote || undefined,
      }),
    })
    setPayoutLoading(false)
    if (!res.ok) return toast.error('Xato')
    toast.success('Foyiz to\'landi')
    setPayoutAmount('')
    setPayoutNote('')
    fetchCashback()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Mijozlar</h1>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Ism yoki telefon qidirish..." className="pl-9" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {customers.map(c => (
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
        {customers.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">Mijoz topilmadi</div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Tahrirlash' : 'Yangi mijoz'}</DialogTitle>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {detailCustomer?.name}
            </DialogTitle>
          </DialogHeader>

          {detailCustomer && detailCustomer.cashbackPercent > 0 ? (
            <div className="space-y-4">
              {/* Period selector */}
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Davr:</Label>
                <Select value={period} onValueChange={(v: 'month' | 'year') => setPeriod(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Bu oy</SelectItem>
                    <SelectItem value="year">Bu yil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {cashbackLoading ? (
                <div className="text-center text-slate-400 py-4">Yuklanmoqda...</div>
              ) : cashbackData ? (
                <>
                  {/* Stats */}
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

                  {cashbackData.remaining > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-xs text-amber-600">Qoldiq</div>
                      <div className="font-bold text-amber-700 text-lg">{formatPrice(cashbackData.remaining)}</div>
                    </div>
                  )}

                  {/* Payout form */}
                  {cashbackData.remaining > 0 && (
                    <div className="border rounded-lg p-3 space-y-2.5">
                      <div className="text-sm font-medium text-slate-700">Foyiz to&apos;lash</div>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Summa" value={payoutAmount}
                          onChange={e => setPayoutAmount(e.target.value)} className="flex-1" />
                        <Select value={payoutType} onValueChange={(v: 'money' | 'gift') => setPayoutType(v)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="money"><Banknote className="w-3.5 h-3.5 inline mr-1" />Pul</SelectItem>
                            <SelectItem value="gift"><Gift className="w-3.5 h-3.5 inline mr-1" />Sovg&apos;a</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input placeholder="Izoh (ixtiyoriy)" value={payoutNote}
                        onChange={e => setPayoutNote(e.target.value)} />
                      <Button size="sm" className="w-full" onClick={handlePayout} disabled={payoutLoading}>
                        {payoutLoading ? 'Saqlanmoqda...' : 'To\'lash'}
                      </Button>
                    </div>
                  )}

                  {/* Payout history */}
                  {cashbackData.payouts.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-slate-700">To&apos;lovlar tarixi</div>
                      {cashbackData.payouts.map(p => (
                        <div key={p._id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-slate-700">{formatPrice(p.amount)}</div>
                            <div className="text-xs text-slate-500">
                              {new Date(p.createdAt).toLocaleDateString('uz-UZ')}
                              {p.note && ` — ${p.note}`}
                            </div>
                          </div>
                          <Badge className={p.type === 'gift' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'}>
                            {p.type === 'gift' ? 'Sovg\'a' : 'Pul'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-6">
              <Percent className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Bu mijozga foyiz belgilanmagan
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
