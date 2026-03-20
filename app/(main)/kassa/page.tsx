'use client'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Search, Trash2, LayoutGrid, List } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'
import { useDebounce, useFetchWithCache, useBarcodeScan } from '@/lib/hooks'
import { printReceipt } from '@/lib/print'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { PaymentDialog, type SalePayment } from './PaymentDialog'
import SalesLog from './SalesLog'
import BarcodeScanner from './BarcodeScanner'

interface Product {
  _id: string
  name: string
  unit: string
  salePrice: number
  costPrice: number
  wholesalePrice?: number
  category?: { name: string }
  stock: number
  image?: string
}

interface CartItem extends Product {
  qty: number
  price: number
}

interface SavedCart {
  _id: string
  name: string
  items: { product: Product; qty: number }[]
  createdBy?: { name: string }
  createdAt: string
}

export default function KassaPage() {
  const { data: session } = useSession()
  const [shopSettings, setShopSettings] = useState<{ shopName?: string; shopPhone?: string; receiptFooter?: string }>({})
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payDialog, setPayDialog] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [customTotal, setCustomTotal] = useState<number | null>(null)
  const [editingTotal, setEditingTotal] = useState(false)
  const [editTotalValue, setEditTotalValue] = useState('')

  // Saved carts
  const [savedCarts, setSavedCarts] = useState<SavedCart[]>([])
  const [savedCartsDialog, setSavedCartsDialog] = useState(false)
  const [saveNameDialog, setSaveNameDialog] = useState(false)
  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(setShopSettings).catch(() => {})
  }, [])

  const debouncedSearch = useDebounce(search)
  const productsUrl = useMemo(() => `/api/products?search=${debouncedSearch}`, [debouncedSearch])
  const { data: fetchedProducts, loading: productsLoading } = useFetchWithCache<Product[]>(productsUrl)
  const products = useMemo(() => {
    const list = fetchedProducts || []
    return [...list].sort((a, b) => {
      const aIn = (a.stock ?? 0) > 0 ? 0 : 1
      const bIn = (b.stock ?? 0) > 0 ? 0 : 1
      return aIn - bIn
    })
  }, [fetchedProducts])

  function getItemPrice(p: Product) {
    return p.salePrice
  }

  const addToCart = useCallback((product: Product) => {
    if ((product.stock ?? 0) <= 0) return toast.error(`${product.name}: stokda yo'q`)
    setCustomTotal(null)
    setCart(prev => {
      const existing = prev.find(c => c._id === product._id)
      if (existing) {
        const newQty = existing.qty + 1
        if (newQty > product.stock) return (toast.error(`${product.name}: stokda ${product.stock} ta`), prev)
        return prev.map(c => c._id === product._id ? { ...c, qty: newQty, price: getItemPrice(product) } : c)
      }
      return [...prev, { ...product, qty: 1, price: getItemPrice(product) }]
    })
  }, [])

  // Barcode scanner — fetch product by ID and add to cart
  const handleBarcodeScan = useCallback(async (code: string) => {
    try {
      const res = await fetch(`/api/products/${code}`)
      if (!res.ok) return toast.error('Mahsulot topilmadi')
      const product: Product = await res.json()
      addToCart(product)
      toast.success(`${product.name} qo'shildi`)
    } catch {
      toast.error('Skaner xatosi')
    }
  }, [addToCart])

  useBarcodeScan(handleBarcodeScan)

  // Saved carts functions
  const fetchSavedCarts = useCallback(async () => {
    const res = await fetch('/api/saved-carts')
    if (!res.ok) return toast.error('Saqlangan ro\'yxatlarni yuklashda xato')
    setSavedCarts(await res.json())
  }, [])

  const handleSaveCart = useCallback(() => {
    setSaveName('')
    setSaveNameDialog(true)
  }, [])

  const confirmSaveCart = useCallback(async () => {
    if (!saveName.trim()) return toast.error('Nom kiriting')
    const res = await fetch('/api/saved-carts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: saveName.trim(),
        items: cart.map(c => ({ product: c._id, qty: c.qty })),
        createdBy: session?.user?.id,
      }),
    })
    if (!res.ok) return toast.error('Saqlashda xato')
    toast.success('Ro\'yxat saqlandi')
    setSaveNameDialog(false)
    fetchSavedCarts()
  }, [saveName, cart, session, fetchSavedCarts])

  const loadSavedCart = useCallback((sc: SavedCart) => {
    const newCart: CartItem[] = []
    for (const item of sc.items) {
      if (!item.product) continue
      const p = item.product
      newCart.push({ ...p, qty: item.qty, price: getItemPrice(p) })
    }
    setCart(newCart)
    setCustomTotal(null)
    setSavedCartsDialog(false)
    toast.success(`"${sc.name}" yuklandi`)
  }, [])

  const deleteSavedCart = useCallback(async (id: string) => {
    const res = await fetch(`/api/saved-carts/${id}`, { method: 'DELETE' })
    if (!res.ok) return toast.error('O\'chirishda xato')
    setSavedCarts(prev => prev.filter(c => c._id !== id))
    toast.success('O\'chirildi')
  }, [])

  const openSavedCarts = useCallback(() => {
    fetchSavedCarts()
    setSavedCartsDialog(true)
  }, [fetchSavedCarts])

  const updateQty = useCallback((id: string, qty: number) => {
    setCustomTotal(null)
    if (isNaN(qty)) { setCart(prev => prev.map(c => c._id === id ? { ...c, qty: 0, price: getItemPrice(c) } : c)); return }
    if (qty <= 0) { setCart(prev => prev.filter(c => c._id !== id)); return }
    setCart(prev => {
      const item = prev.find(c => c._id === id)
      if (item && qty > item.stock) {
        toast.error(`${item.name}: stokda ${item.stock} ta`)
        return prev.map(c => c._id === id ? { ...c, qty: item.stock, price: getItemPrice(c) } : c)
      }
      return prev.map(c => c._id === id ? { ...c, qty, price: getItemPrice(c) } : c)
    })
  }, [])

  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])
  const finalTotal = customTotal ?? total
  const discount = customTotal !== null ? total - customTotal : 0

  const startEditTotal = useCallback(() => {
    setEditTotalValue(String(finalTotal))
    setEditingTotal(true)
  }, [finalTotal])

  const commitEditTotal = useCallback(() => {
    const val = Number(editTotalValue)
    if (val > 0 && val !== total) {
      setCustomTotal(val)
    } else {
      setCustomTotal(null)
    }
    setEditingTotal(false)
  }, [editTotalValue, total])

  function openPayDialog() {
    setPayDialog(true)
  }

  async function handleCheckout(payments: SalePayment[], extra: { ustaId?: string; debtorName?: string; debtorPhone?: string }) {
    const paid = payments.reduce((s, p) => s + p.amount, 0)
    const isDebt = paid < finalTotal
    if (cart.length === 0) return toast.error('Savat bo\'sh')
    if (payments.length === 0 && !isDebt) return toast.error('To\'lov usulini tanlang')
    if (isDebt && !extra.debtorName?.trim()) return toast.error('Qarz bo\'lganda qarzdor ismi majburiy')
    if (isDebt && !extra.debtorPhone?.trim()) return toast.error('Qarz bo\'lganda telefon raqam majburiy')

    setLoading(true)

    const actualPaid = Math.min(paid, finalTotal)
    const paymentType = paid >= finalTotal ? 'full' : paid > 0 ? 'partial' : 'debt'

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(c => ({
          product: c._id,
          productName: c.name,
          unit: c.unit,
          qty: c.qty,
          costPrice: c.costPrice,
          salePrice: c.price,
        })),
        total: finalTotal,
        paid: actualPaid,
        cashier: session?.user.id,
        usta: extra.ustaId || undefined,
        debtorName: extra.debtorName || undefined,
        debtorPhone: extra.debtorPhone || undefined,
        paymentType,
        payments,
      }),
    })
    setLoading(false)

    if (!res.ok) return toast.error('Xato yuz berdi')

    const result = await res.json()
    const receiptNo = result.sale?.receiptNo || 0

    await printReceipt({
      receiptNo,
      items: cart.map(c => ({ productName: c.name, qty: c.qty, unit: c.unit, salePrice: c.price })),
      total: finalTotal,
      paid: actualPaid,
      originalTotal: discount > 0 ? total : undefined,
      cashier: session?.user?.name || 'Kassir',
      customer: extra.debtorName || undefined,
      paymentType,
      createdAt: new Date(),
      shopName: shopSettings.shopName,
      shopPhone: shopSettings.shopPhone,
      receiptFooter: shopSettings.receiptFooter,
    })

    const debt = finalTotal - paid
    if (isDebt) {
      toast.success(`Sotuv saqlandi. Qarz: ${formatPrice(debt)}`)
    } else if (paid > finalTotal) {
      toast.success(`Sotuv saqlandi. Qaytim: ${formatPrice(-debt)}`)
    } else {
      toast.success('Sotuv muvaffaqiyatli!')
    }

    setCart([])
    setCustomTotal(null)
    setPayDialog(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Products panel */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Kassa</h1>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              <button className={`p-1.5 ${viewMode === 'grid' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('grid')}>
                <LayoutGrid className="w-4 h-4 text-slate-600" />
              </button>
              <button className={`p-1.5 ${viewMode === 'table' ? 'bg-slate-100' : 'hover:bg-slate-50'}`} onClick={() => setViewMode('table')}>
                <List className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <BarcodeScanner onScan={handleBarcodeScan} />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Mahsulot qidirish..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {productsLoading && products.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-square bg-slate-200" />
                    <div className="p-2.5 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                ))
              : products.map(p => (
                  <ProductCard key={p._id} product={p} onClick={addToCart} />
                ))
            }
            {!productsLoading && products.length === 0 && (
              <div className="col-span-full text-center text-slate-400 py-8">Mahsulot topilmadi</div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2.5 font-medium">Nom</th>
                  <th className="px-3 py-2.5 font-medium text-right">Narx</th>
                  <th className="px-3 py-2.5 font-medium text-right">Stok</th>
                  <th className="px-3 py-2.5 font-medium text-right w-16"></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const outOfStock = (p.stock ?? 0) <= 0
                  return (
                    <tr key={p._id} className={`border-b last:border-0 ${outOfStock ? 'opacity-50' : 'hover:bg-slate-50 cursor-pointer'}`}
                      onClick={() => !outOfStock && addToCart(p)}>
                      <td className="px-3 py-2 font-medium text-slate-800">{p.name}</td>
                      <td className="px-3 py-2 text-right text-blue-600 font-medium">{formatPrice(p.salePrice)}</td>
                      <td className={`px-3 py-2 text-right ${outOfStock ? 'text-red-600' : 'text-slate-600'}`}>
                        {p.stock} {p.unit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!outOfStock && (
                          <button className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center"
                            onClick={e => { e.stopPropagation(); addToCart(p) }}>
                            <span className="text-white text-lg leading-none">+</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!productsLoading && products.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-slate-400 py-8">Mahsulot topilmadi</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 xl:w-96 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <CartPanel
          cart={cart}
          total={total}
          finalTotal={finalTotal}
          discount={discount}
          editingTotal={editingTotal}
          editTotalValue={editTotalValue}
          onUpdateQty={updateQty}
          onClear={() => setCart([])}
          onPay={openPayDialog}
          onStartEditTotal={startEditTotal}
          onCommitEditTotal={commitEditTotal}
          onEditTotalChange={setEditTotalValue}
          onSaveCart={handleSaveCart}
          onLoadCart={openSavedCarts}
          savedCartsCount={savedCarts.length}
        />

        <div className="mt-4">
          <SalesLog cashierId={session?.user.role === 'worker' ? session.user.id : undefined} />
        </div>
      </div>

      {/* Payment dialog */}
      <PaymentDialog
        open={payDialog}
        onOpenChange={setPayDialog}
        total={total}
        finalTotal={finalTotal}
        discount={discount}
        loading={loading}
        cart={cart}
        onTotalChange={setCustomTotal}
        onCheckout={handleCheckout}
      />

      {/* Save cart name dialog */}
      <Dialog open={saveNameDialog} onOpenChange={setSaveNameDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Ro&apos;yxatni saqlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Ro'yxat nomi"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmSaveCart()}
              autoFocus
            />
            <div className="text-xs text-slate-500">{cart.length} ta mahsulot saqlanadi</div>
            <Button className="w-full" onClick={confirmSaveCart}>Saqlash</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Saved carts dialog */}
      <Dialog open={savedCartsDialog} onOpenChange={setSavedCartsDialog}>
        <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saqlangan ro&apos;yxatlar</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {savedCarts.map(sc => (
              <div key={sc._id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="font-medium text-sm text-slate-800">{sc.name}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(sc.createdAt).toLocaleDateString('uz-UZ')}
                      {sc.createdBy?.name && ` — ${sc.createdBy.name}`}
                    </div>
                  </div>
                  <button className="p-1 hover:bg-red-50 rounded" onClick={() => deleteSavedCart(sc._id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  {sc.items.filter(i => i.product).map(i => `${i.product.name} x${i.qty}`).join(', ')}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => loadSavedCart(sc)}>
                  Savatga yuklash
                </Button>
              </div>
            ))}
            {savedCarts.length === 0 && (
              <div className="text-center text-slate-400 py-6">Saqlangan ro&apos;yxat yo&apos;q</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
