'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Trash2, LayoutGrid, List, Package, AlertTriangle, Pencil, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useDebounce, useFetchWithCache } from '@/lib/hooks'
import CategoryCarousel from '@/components/CategoryCarousel'
import { formatPrice } from '@/lib/utils'
import { printLabel } from '@/lib/print'
import { TovarProductCard } from './ProductCard'
import { ProductDialog, type ProductForm } from './ProductDialog'

interface Category { _id: string; name: string }
interface Product {
  _id: string; name: string; unit: string; costPrice: number; salePrice: number
  wholesalePrice?: number
  image?: string; isActive: boolean; category?: Category; stock: number
}

const emptyForm: ProductForm = {
  name: '', categoryId: '', unit: 'dona', costPrice: '', salePrice: '',
  wholesalePrice: '', image: '', stock: ''
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Product stats
  const { data: stats } = useFetchWithCache<{
    totalProducts: number; totalCostValue: number; totalSaleValue: number; lowStockCount: number
  }>('/api/product-stats')

  const debouncedSearch = useDebounce(search)
  const productsUrl = (() => {
    const params = new URLSearchParams({ search: debouncedSearch })
    if (catFilter !== 'all') params.set('category', catFilter)
    return `/api/products?${params}`
  })()
  const { data: fetchedProducts, loading: productsLoading, refresh: fetchProducts } = useFetchWithCache<Product[]>(productsUrl)
  const allProducts = useMemo(() => {
    const list = fetchedProducts || []
    return [...list].sort((a, b) => {
      const aIn = (a.stock ?? 0) > 0 ? 0 : 1
      const bIn = (b.stock ?? 0) > 0 ? 0 : 1
      return aIn - bIn
    })
  }, [fetchedProducts])

  // Infinite scroll: show products in batches
  const BATCH = 20
  const [visibleCount, setVisibleCount] = useState(BATCH)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Reset visible count when products change (search/filter)
  useEffect(() => { setVisibleCount(BATCH) }, [productsUrl])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(prev => prev + BATCH)
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [allProducts.length])

  const products = allProducts.slice(0, visibleCount)
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(setCategories)
  }, [])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setDialog(true)
  }

  const openEdit = useCallback(async (p: Product) => {
    setEditing(p)
    // Fetch full product with image (list excludes image for performance)
    const res = await fetch(`/api/products/${p._id}`)
    const full = res.ok ? await res.json() : p
    setForm({
      name: full.name,
      categoryId: full.category?._id || '',
      unit: full.unit,
      costPrice: full.costPrice.toString(),
      salePrice: full.salePrice.toString(),
      wholesalePrice: full.wholesalePrice?.toString() || '',
      image: full.image || '',
      stock: full.stock?.toString() || '0',
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
      wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : undefined,
      image: form.image && !form.image.startsWith('blob:') ? form.image : undefined,
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
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
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
      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-medium">Umumiy tovarlar</span>
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-800">{stats.totalProducts} ta</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-medium">Jami tannarx</span>
                <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-orange-500" />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-800">{formatPrice(stats.totalCostValue)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-medium">Jami sotuv narx</span>
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 text-green-500" />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-800">{formatPrice(stats.totalSaleValue)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-500 font-medium">Kam qolgan</span>
                <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                </div>
              </div>
              <div className="text-lg font-bold text-slate-800">{stats.lowStockCount} ta</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">Tovarlar</h1>
        <div className="flex gap-2">
          <div className="flex border rounded-lg overflow-hidden">
            <button className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4 text-slate-600" />
            </button>
            <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
              <List className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setCatDialog(true)}>Kategoriyalar</Button>
          <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Qo&apos;shish</Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Qidirish..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {categories.length > 0 && (
        <CategoryCarousel
          categories={categories}
          selected={catFilter}
          onSelect={setCatFilter}
        />
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {productsLoading && products.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-[4/3] bg-slate-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
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
      ) : (
        <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Kategoriya</th>
                <th className="px-4 py-3 font-medium text-right">Tannarx</th>
                <th className="px-4 py-3 font-medium text-right">Sotuv narx</th>
                <th className="px-4 py-3 font-medium text-right">Stok</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const outOfStock = (p.stock ?? 0) <= 0
                const lowStock = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5
                return (
                  <tr key={p._id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.category?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{formatPrice(p.costPrice)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-blue-600">{formatPrice(p.salePrice)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${outOfStock ? 'text-red-600' : lowStock ? 'text-amber-600' : 'text-slate-700'}`}>
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button className="p-1.5 hover:bg-blue-50 rounded" onClick={() => printLabel({ _id: p._id, name: p.name, salePrice: p.salePrice, wholesalePrice: p.wholesalePrice, unit: p.unit, category: p.category?.name })}>
                          <Printer className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                        <button className="p-1.5 hover:bg-slate-100 rounded" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button className="p-1.5 hover:bg-red-50 rounded" onClick={() => handleDelete(p._id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!productsLoading && products.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-400 py-12">Mahsulot topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more sentinel */}
      {visibleCount < allProducts.length && <div ref={loadMoreRef} className="h-1" />}

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
                    const res = await fetch(`/api/categories/${c._id}`, { method: 'DELETE' })
                    if (!res.ok) { const err = await res.json(); toast.error(err.error || 'O\'chirishda xato'); return }
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
