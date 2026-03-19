'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Wallet, Search, CreditCard, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
import { NumberInput } from '@/components/ui/NumberInput'

interface PersonalDebt {
  _id: string
  name: string
  phone?: string
  direction: 'receivable' | 'payable'
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  note?: string
  createdAt: string
  payments: { amount: number; date: string; note?: string }[]
}

export default function ShaxsiyQarzlarPage() {
  const [debts, setDebts] = useState<PersonalDebt[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [payDialog, setPayDialog] = useState(false)
  const [addDialog, setAddDialog] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState<PersonalDebt | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', phone: '', amount: '', note: '' })

  const fetchDebts = useCallback(async () => {
    const params = new URLSearchParams({ status })
    if (search) params.set('search', search)
    const res = await fetch(`/api/personal-debts?${params}`)
    if (!res.ok) return toast.error('Yuklashda xato')
    setDebts(await res.json())
  }, [status, search])

  useEffect(() => { fetchDebts() }, [fetchDebts])

  const receivableTotal = debts.filter(d => d.status === 'active' && d.direction === 'receivable').reduce((s, d) => s + d.remainingAmount, 0)
  const payableTotal = debts.filter(d => d.status === 'active' && d.direction === 'payable').reduce((s, d) => s + d.remainingAmount, 0)

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.amount) return toast.error('Ism va summa majburiy')
    const num = Number(addForm.amount)
    if (!num || num <= 0) return toast.error('Summa noto\'g\'ri')
    setLoading(true)
    const res = await fetch('/api/personal-debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: addForm.name.trim(),
        phone: addForm.phone.trim() || undefined,
        amount: num,
        note: addForm.note || undefined,
        direction: 'payable',
      }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('Qarz qo\'shildi')
    setAddDialog(false)
    setAddForm({ name: '', phone: '', amount: '', note: '' })
    fetchDebts()
  }

  async function handlePay() {
    if (!selectedDebt) return
    const num = Number(amount)
    if (!num || num <= 0) return toast.error('Summa noto\'g\'ri')
    if (num > selectedDebt.remainingAmount) return toast.error('Qarz miqdoridan ko\'p')

    setLoading(true)
    const res = await fetch(`/api/personal-debts/${selectedDebt._id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: num, note }),
    })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success('To\'lov qabul qilindi')
    setPayDialog(false)
    setAmount('')
    setNote('')
    fetchDebts()
  }

  async function handleDelete(id: string) {
    if (!confirm('Qarzni o\'chirishni tasdiqlaysizmi?')) return
    const res = await fetch(`/api/personal-debts/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    toast.success('O\'chirildi')
    fetchDebts()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Shaxsiy qarzlar
          </h1>
          {status === 'active' && payableTotal > 0 && (
            <div className="text-sm text-slate-500 mt-1">
              Jami qarz: <span className="font-bold text-red-600">{formatPrice(payableTotal)}</span>
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />Qarz qo&apos;shish
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Faol qarzlar</SelectItem>
            <SelectItem value="paid">To&apos;langan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {debts.map(d => (
          <Card key={d._id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center bg-red-100">
                    <Wallet className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{d.name}</div>
                    {d.phone && <div className="text-xs text-slate-400">{d.phone}</div>}
                    <div className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString('uz-UZ')}</div>
                    {d.note && <div className="text-xs text-slate-400 italic">{d.note}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={d.status === 'active' ? 'destructive' : 'secondary'} className="mb-1">
                    {d.status === 'active' ? 'Faol' : 'To\'langan'}
                  </Badge>
                  <div className="text-xs text-slate-500">Jami: {formatPrice(d.totalAmount)}</div>
                  <div className="text-xs text-slate-500">To&apos;langan: {formatPrice(d.paidAmount)}</div>
                  {d.status === 'active' && (
                    <div className="text-sm font-bold text-red-600">Qoldi: {formatPrice(d.remainingAmount)}</div>
                  )}
                </div>
              </div>

              {d.status === 'active' && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(d._id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />O&apos;chirish
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedDebt(d); setPayDialog(true) }}>
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />To&apos;lov
                  </Button>
                </div>
              )}

              {d.payments.length > 0 && (
                <div className="mt-3 border-t pt-3">
                  <div className="text-xs text-slate-400 mb-1.5">To&apos;lov tarixi:</div>
                  <div className="space-y-1">
                    {d.payments.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-500">{new Date(p.date).toLocaleDateString('uz-UZ')}{p.note && ` — ${p.note}`}</span>
                        <span className="font-medium text-green-600">{formatPrice(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {debts.length === 0 && (
          <div className="text-center text-slate-400 py-12">Qarz topilmadi</div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Yangi shaxsiy qarz</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Ism *</Label>
              <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="Ism familiya" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefon</Label>
              <Input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} placeholder="+998 XX XXX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>Qarz summasi *</Label>
              <NumberInput value={addForm.amount} onChange={v => setAddForm(f => ({ ...f, amount: v }))} placeholder="Summa" min={0} />
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Input value={addForm.note} onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))} placeholder="Ixtiyoriy" />
            </div>
            <Button className="w-full" onClick={handleAdd} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Qarz to&apos;lovi</DialogTitle></DialogHeader>
          {selectedDebt && (
            <div className="space-y-4">
              <div className="bg-orange-50 rounded-lg p-3 text-sm">
                <div className="font-medium">{selectedDebt.name}</div>
                <div className="text-orange-700 font-bold mt-1">Qolgan qarz: {formatPrice(selectedDebt.remainingAmount)}</div>
              </div>
              <div className="space-y-1.5">
                <Label>To&apos;lov summasi</Label>
                <NumberInput value={amount} onChange={setAmount} placeholder={`Maks: ${selectedDebt.remainingAmount}`} min={0} max={selectedDebt.remainingAmount} />
              </div>
              <div className="space-y-1.5">
                <Label>Izoh (ixtiyoriy)</Label>
                <Input value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handlePay} disabled={loading}>
                {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
