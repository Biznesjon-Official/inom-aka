'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Search, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks'

interface Product {
  _id: string
  name: string
  unit: string
  costPrice: number
  salePrice: number
  stock: number
}

interface IntakeItem {
  product: string
  productName: string
  qty: number
  costPrice: number
}

interface StockIntake {
  _id: string
  items: { product?: { _id: string; name: string; unit: string }; productName: string; qty: number; costPrice: number }[]
  supplier?: string
  note?: string
  totalCost: number
  createdBy?: { name: string }
  createdAt: string
}

export default function OmborPage() {
  const [intakes, setIntakes] = useState<StockIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialog, setAddDialog] = useState(false)
  const [detailDialog, setDetailDialog] = useState<StockIntake | null>(null)

  // Form state
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<IntakeItem[]>([])
  const [saving, setSaving] = useState(false)

  // Product search
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [showSearch, setShowSearch] = useState(false)

  const fetchIntakes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/stock-intakes')
    if (!res.ok) { toast.error('Kirimlarni yuklashda xato'); setLoading(false); return }
    setIntakes(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchIntakes() }, [fetchIntakes])

  // Product search
  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setSearchResults([]); return }
    fetch(`/api/products?search=${encodeURIComponent(debouncedSearch)}&active=true`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSearchResults(Array.isArray(data) ? data : data.products || []))
  }, [debouncedSearch])

  function addProduct(product: Product) {
    // Check if already added
    if (items.some(i => i.product === product._id)) {
      toast.error('Bu mahsulot allaqachon qo\'shilgan')
      return
    }
    setItems(prev => [...prev, {
      product: product._id,
      productName: product.name,
      qty: 1,
      costPrice: product.costPrice,
    }])
    setSearchTerm('')
    setSearchResults([])
    setShowSearch(false)
  }

  function updateItem(index: number, field: 'qty' | 'costPrice', value: number) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalCost = items.reduce((sum, item) => sum + item.qty * item.costPrice, 0)

  async function handleSave() {
    if (items.length === 0) return toast.error('Kamida 1 ta mahsulot qo\'shing')
    if (items.some(i => i.qty <= 0)) return toast.error('Miqdor 0 dan katta bo\'lishi kerak')

    setSaving(true)
    const res = await fetch('/api/stock-intakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, supplier, note }),
    })
    setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return toast.error(err.error || 'Saqlashda xato')
    }

    const intake = await res.json()
    setIntakes(prev => [intake, ...prev])
    resetForm()
    setAddDialog(false)
    toast.success('Kirim saqlandi')
  }

  function resetForm() {
    setSupplier('')
    setNote('')
    setItems([])
    setSearchTerm('')
    setSearchResults([])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Ombor kirimi</h1>
        <Button size="sm" onClick={() => setAddDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />Yangi kirim
        </Button>
      </div>

      {/* Intakes list */}
      <div className="space-y-2">
        {loading && <div className="text-center text-slate-400 py-12">Yuklanmoqda...</div>}
        {!loading && intakes.length === 0 && (
          <div className="text-center text-slate-400 py-12">Kirim topilmadi</div>
        )}
        {intakes.map(intake => (
          <Card
            key={intake._id}
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setDetailDialog(intake)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {intake.supplier || 'Noma\'lum yetkazuvchi'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(intake.createdAt).toLocaleDateString('uz-UZ')}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {intake.items.length} ta mahsulot
                  {intake.createdBy && <span> &middot; {intake.createdBy.name}</span>}
                </div>
              </div>
              <div className="text-blue-600 dark:text-blue-400 font-bold text-sm whitespace-nowrap">
                {formatPrice(intake.totalCost)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kirim tafsiloti</DialogTitle>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-500">Sana:</div>
                <div>{new Date(detailDialog.createdAt).toLocaleString('uz-UZ')}</div>
                <div className="text-slate-500">Yetkazuvchi:</div>
                <div>{detailDialog.supplier || '-'}</div>
                {detailDialog.note && <>
                  <div className="text-slate-500">Izoh:</div>
                  <div>{detailDialog.note}</div>
                </>}
                <div className="text-slate-500">Xodim:</div>
                <div>{detailDialog.createdBy?.name || '-'}</div>
              </div>
              <div className="border-t pt-2">
                <div className="text-sm font-medium mb-2">Mahsulotlar:</div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {detailDialog.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded">
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-slate-500">{item.qty} x {formatPrice(item.costPrice)}</div>
                      </div>
                      <div className="font-medium">{formatPrice(item.qty * item.costPrice)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center border-t pt-2 font-bold">
                <span>Jami:</span>
                <span className="text-blue-600">{formatPrice(detailDialog.totalCost)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add intake dialog */}
      <Dialog open={addDialog} onOpenChange={v => { if (!v) resetForm(); setAddDialog(v) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yangi kirim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Yetkazuvchi</Label>
                <Input
                  placeholder="Ixtiyoriy"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Izoh</Label>
                <Input
                  placeholder="Ixtiyoriy"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Product search */}
            <div className="space-y-1.5">
              <Label>Mahsulot qo&apos;shish</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Mahsulot nomi..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setShowSearch(true) }}
                  onFocus={() => setShowSearch(true)}
                />
                {showSearch && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(p => (
                      <button
                        key={p._id}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm flex justify-between items-center"
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.name}</span>
                        <span className="text-xs text-slate-400">
                          {p.stock} {p.unit} &middot; {formatPrice(p.costPrice)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items list */}
            {items.length > 0 && (
              <div className="space-y-2">
                <Label>Mahsulotlar ({items.length})</Label>
                {items.map((item, i) => (
                  <div key={item.product} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.productName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Jami: {formatPrice(item.qty * item.costPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        className="w-16 h-8 text-center text-sm"
                        value={item.qty}
                        min={1}
                        onChange={e => updateItem(i, 'qty', Number(e.target.value))}
                      />
                      <Input
                        type="number"
                        className="w-24 h-8 text-sm"
                        value={item.costPrice}
                        min={0}
                        onChange={e => updateItem(i, 'costPrice', Number(e.target.value))}
                        placeholder="Narx"
                      />
                      <button onClick={() => removeItem(i)} className="p-1 hover:bg-red-50 rounded">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total */}
            {items.length > 0 && (
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <span className="font-medium">Jami summa:</span>
                <span className="text-lg font-bold text-blue-600">{formatPrice(totalCost)}</span>
              </div>
            )}

            <Button className="w-full" onClick={handleSave} disabled={saving || items.length === 0}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
