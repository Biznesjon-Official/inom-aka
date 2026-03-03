'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebounce, useFetchWithCache } from '@/lib/hooks'
import { TovarProductCard } from './ProductCard'
import { ProductDialog, type ProductForm } from './ProductDialog'

interface Category { _id: string; name: string }
interface Product {
  _id: string; name: string; unit: string; costPrice: number; salePrice: number
  discountPrice?: number; discountThreshold?: number; description?: string
  image?: string; isActive: boolean; category?: Category; stock: number
}

const emptyForm: ProductForm = {
  name: '', categoryId: '', unit: 'dona', costPrice: '', salePrice: '',
  discountPrice: '', discountThreshold: '', description: '', image: '', stock: ''
}

export default function TovarlarPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [dialog, setDialog] = useState(false)
  const [catDialog, setCatDialog] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [newCat, setNewCat] = useState('')
  const [loading, setLoading] = useState(false)

  const debouncedSearch = useDebounce(search)
  const productsUrl = (() => {
    const params = new URLSearchParams({ search: debouncedSearch, fields: 'list' })
    if (catFilter !== 'all') params.set('category', catFilter)
    return `/api/products?${params}`
  })()
  const { data: fetchedProducts, loading: productsLoading, refresh: fetchProducts } = useFetchWithCache<Product[]>(productsUrl)
  const products = fetchedProducts || []
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialog(true)
  }

  const openEdit = useCallback((p: Product) => {
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
  }, [])

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

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('O\'chirishni tasdiqlaysizmi?')) return
    await fetch(`/api/products/${id}`, { method: 'DELETE' })
    toast.success('O\'chirildi')
    fetchProducts()
  }, [fetchProducts])

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
        {productsLoading && products.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-4 flex gap-3 animate-pulse">
                <div className="w-16 h-16 bg-slate-200 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-3 bg-slate-200 rounded w-1/3" />
                </div>
              </div>
            ))
          : products.map(p => (
              <TovarProductCard key={p._id} product={p} onEdit={openEdit} onDelete={handleDelete} />
            ))
        }
        {!productsLoading && products.length === 0 && (
          <div className="col-span-full text-center text-slate-400 py-12">Mahsulot topilmadi</div>
        )}
      </div>

      {/* Product dialog */}
      <ProductDialog
        open={dialog}
        onOpenChange={setDialog}
        editing={!!editing}
        form={form}
        onFormChange={setForm}
        categories={categories}
        loading={loading}
        onSave={handleSave}
      />

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
    </div>
  )
}
