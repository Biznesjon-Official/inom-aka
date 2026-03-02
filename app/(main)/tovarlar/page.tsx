'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Pencil, Trash2, Package, Camera, Image, Printer } from 'lucide-react'
import { printLabel } from '@/lib/print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'

interface Category { _id: string; name: string }
interface Product {
  _id: string; name: string; unit: string; costPrice: number; salePrice: number
  discountPrice?: number; discountThreshold?: number; description?: string
  image?: string; isActive: boolean; category?: Category; stock: number
}

const UNITS = ['dona', 'kg', 'm', 'l']

const emptyForm = {
  name: '', categoryId: '', unit: 'dona', costPrice: '', salePrice: '',
  discountPrice: '', discountThreshold: '', description: '', image: '', stock: ''
}

export default function TovarlarPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [dialog, setDialog] = useState(false)
  const [catDialog, setCatDialog] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newCat, setNewCat] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams({ search })
    if (catFilter !== 'all') params.set('category', catFilter)
    const res = await fetch(`/api/products?${params}`)
    setProducts(await res.json())
  }, [search, catFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialog(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      categoryId: p.category?._id || '',
      unit: p.unit,
      costPrice: p.costPrice.toString(),
      salePrice: p.salePrice.toString(),
      discountPrice: p.discountPrice?.toString() || '',
      discountThreshold: p.discountThreshold?.toString() || '',
      description: p.description || '',
      image: p.image || '',
      stock: p.stock?.toString() || '0',
    })
    setDialog(true)
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, image: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    if (!form.name || !form.costPrice || !form.salePrice) {
      return toast.error('Nom, tannarx va sotuv narxi majburiy')
    }
    setLoading(true)
    const body = {
      name: form.name,
      category: form.categoryId || undefined,
      unit: form.unit,
      costPrice: Number(form.costPrice),
      salePrice: Number(form.salePrice),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : undefined,
      discountThreshold: form.discountThreshold ? Number(form.discountThreshold) : undefined,
      description: form.description || undefined,
      image: form.image || undefined,
      stock: form.stock !== '' ? Number(form.stock) : 0,
    }
    const url = editing ? `/api/products/${editing._id}` : '/api/products'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setLoading(false)
    if (!res.ok) return toast.error('Xato yuz berdi')
    toast.success(editing ? 'Yangilandi' : 'Qo\'shildi')
    setDialog(false)
    fetchProducts()
  }

  async function handleDelete(id: string) {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    toast.success('O\'chirildi')
    fetchProducts()
  }

  async function addCategory() {
    if (!newCat.trim()) return
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCat }) })
    const cat = await res.json()
    setCategories(prev => [...prev, cat])
    setNewCat('')
    toast.success('Kategoriya qo\'shildi')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Tovarlar</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCatDialog(true)}>Kategoriyalar</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Kategoriya" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barchasi</SelectItem>
            {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {products.map(p => (
          <Card key={p._id} className="border-0 shadow-sm">
            <CardContent className="p-4 flex gap-3">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-800 text-sm line-clamp-1">{p.name}</div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button className="p-1 hover:bg-blue-50 rounded" title="Label chiqarish" onClick={async () => { await printLabel({ name: p.name, salePrice: p.salePrice, unit: p.unit, category: p.category?.name, discountPrice: p.discountPrice, discountThreshold: p.discountThreshold }) }}>
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                    <button className="p-1 hover:bg-slate-100 rounded" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button className="p-1 hover:bg-red-50 rounded" onClick={() => handleDelete(p._id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                {p.category && <Badge variant="outline" className="text-xs mt-0.5">{p.category.name}</Badge>}
                <div className="mt-2 space-y-0.5">
                  <div className="text-xs text-slate-500">Tannarx: <span className="font-medium">{formatPrice(p.costPrice)}</span></div>
                  <div className="text-xs text-blue-600 font-bold">{formatPrice(p.salePrice)} / {p.unit}</div>
                  {p.discountPrice && p.discountThreshold && (
                    <div className="text-xs text-green-600">{p.discountThreshold}+ dona: {formatPrice(p.discountPrice)}</div>
                  )}
                  <div className={`text-xs font-medium mt-1 ${(p.stock ?? 0) <= 0 ? 'text-red-500' : (p.stock ?? 0) <= 5 ? 'text-orange-500' : 'text-slate-500'}`}>
                    Qoldiq: {p.stock ?? 0} {p.unit}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">Mahsulot topilmadi</div>
        )}
      </div>

      {/* Product dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Tahrirlash' : 'Yangi mahsulot'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Kategoriya</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tanlang" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Birlik</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tannarx *</Label>
                <Input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sotuv narxi *</Label>
                <Input type="number" value={form.salePrice} onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Qoldiq *</Label>
                <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ulgurji narx</Label>
                <Input type="number" placeholder="Ko'p olsangiz" value={form.discountPrice} onChange={e => setForm(f => ({ ...f, discountPrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Minimal miqdor</Label>
                <Input type="number" placeholder="Nechta dan" value={form.discountThreshold} onChange={e => setForm(f => ({ ...f, discountThreshold: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Izoh</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rasm</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-1.5" />Kamera
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => galleryInputRef.current?.click()}>
                  <Image className="w-4 h-4 mr-1.5" />Galereya
                </Button>
              </div>
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
              )}
            </div>
            <Button className="w-full" onClick={handleSave} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Kategoriyalar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Yangi kategoriya" value={newCat} onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()} />
              <Button onClick={addCategory}><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map(c => (
                <div key={c._id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-sm">{c.name}</span>
                  <button onClick={async () => {
                    await fetch(`/api/categories/${c._id}`, { method: 'DELETE' })
                    setCategories(prev => prev.filter(x => x._id !== c._id))
                  }}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs — outside Dialog to avoid portal ref issues */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImage} />
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
    </div>
  )
}
