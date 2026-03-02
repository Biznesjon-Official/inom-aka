'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Users, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'

interface Customer {
  _id: string; name: string; phone?: string; address?: string; note?: string; totalDebt: number
}

const emptyForm = { name: '', phone: '', address: '', note: '' }

export default function MijozlarPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const fetchCustomers = useCallback(async () => {
    const res = await fetch(`/api/customers?search=${encodeURIComponent(search)}`)
    setCustomers(await res.json())
  }, [search])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  function openAdd() { setEditing(null); setForm(emptyForm); setDialog(true) }
  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone || '', address: c.address || '', note: c.note || '' })
    setDialog(true)
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

  async function handleDelete(id: string) {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    toast.success('O\'chirildi')
    fetchCustomers()
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
          <Card key={c._id} className="border-0 shadow-sm">
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
                  <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openEdit(c)}>
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button className="p-1 hover:bg-red-50 rounded" onClick={() => handleDelete(c._id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              {c.address && <div className="text-xs text-slate-500 mt-2">{c.address}</div>}
              {c.note && <div className="text-xs text-slate-400 mt-1 italic">{c.note}</div>}
              {c.totalDebt > 0 && (
                <div className="mt-2">
                  <Badge variant="destructive" className="text-xs">
                    Qarz: {formatPrice(c.totalDebt)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {customers.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">Mijoz topilmadi</div>
        )}
      </div>

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
              <Label>Izoh</Label>
              <Textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
