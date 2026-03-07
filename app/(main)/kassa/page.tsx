'use client'
import { useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'
import { useDebounce, useFetchWithCache, useBarcodeScan } from '@/lib/hooks'
import { printReceipt } from '@/lib/print'
import { ProductCard } from './ProductCard'
import { CartPanel } from './CartPanel'
import { PaymentDialog } from './PaymentDialog'
import SalesLog from './SalesLog'
import BarcodeScanner from './BarcodeScanner'

interface Product {
  _id: string
  name: string
  unit: string
  salePrice: number
  costPrice: number
  discountPrice?: number
  discountThreshold?: number
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
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [payDialog, setPayDialog] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [customTotal, setCustomTotal] = useState<number | null>(null)
  const [editingTotal, setEditingTotal] = useState(false)
  const [editTotalValue, setEditTotalValue] = useState('')

  // Saved carts
  const [savedCarts, setSavedCarts] = useState<SavedCart[]>([])
  const [savedCartsDialog, setSavedCartsDialog] = useState(false)
  const [saveNameDialog, setSaveNameDialog] = useState(false)
  const [saveName, setSaveName] = useState('')

  const debouncedSearch = useDebounce(search)
  const productsUrl = `/api/products?search=${encodeURIComponent(debouncedSearch)}`
  const { data: fetchedProducts, loading: productsLoading } = useFetchWithCache<Product[]>(productsUrl)
  const products = fetchedProducts || []

  function getItemPrice(p: Product, qty: number) {
    if (p.discountPrice && p.discountThreshold && qty >= p.discountThreshold) return p.discountPrice
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
        return prev.map(c => c._id === product._id ? { ...c, qty: newQty, price: getItemPrice(product, newQty) } : c)
      }
      return [...prev, { ...product, qty: 1, price: getItemPrice(product, 1) }]
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
    if (res.ok) setSavedCarts(await res.json())
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
      newCart.push({ ...p, qty: item.qty, price: getItemPrice(p, item.qty) })
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
    if (qty <= 0) { setCart(prev => prev.filter(c => c._id !== id)); return }
    setCart(prev => prev.map(c => c._id === id ? { ...c, qty, price: getItemPrice(c, qty) } : c))
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
    setPaidAmount('')
    setClientName('')
    setClientPhone('')
    setPayDialog(true)
  }

  async function handleCheckout() {
    const paid = Number(paidAmount) || 0
    const isDebt = paid < finalTotal
    if (cart.length === 0) return toast.error('Savat bo\'sh')
    if (!paidAmount || paid < 0) return toast.error('To\'langan summani kiriting')
    if (isDebt && !clientName.trim()) return toast.error('Qarz bo\'lganda mijoz ismi majburiy')
    if (isDebt && !clientPhone.trim()) return toast.error('Qarz bo\'lganda telefon raqam majburiy')

    setLoading(true)

    let customerId: string | undefined
    if (clientName.trim()) {
      const existing = await fetch(`/api/customers?search=${encodeURIComponent(clientName.trim())}`)
      if (!existing.ok) { setLoading(false); return toast.error('Mijoz qidirishda xato') }
      const list = await existing.json()
      const found = list.find((c: { name: string; phone?: string }) =>
        c.name.toLowerCase() === clientName.trim().toLowerCase()
      )
      if (found) {
        customerId = found._id
      } else {
        const created = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: clientName.trim(), phone: clientPhone.trim() || undefined }),
        })
        if (!created.ok) { setLoading(false); return toast.error('Mijoz yaratishda xato') }
        const c = await created.json()
        customerId = c._id
      }
    }

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
        customer: customerId,
        paymentType,
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
      customer: clientName.trim() || undefined,
      paymentType,
      createdAt: new Date(),
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
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Products panel */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Kassa</h1>
          <BarcodeScanner onScan={handleBarcodeScan} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Mahsulot qidirish..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {productsLoading && products.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
                  <div className="w-full h-24 bg-slate-200" />
                  <div className="p-2 space-y-2">
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
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 xl:w-96">
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
        paidAmount={paidAmount}
        clientName={clientName}
        clientPhone={clientPhone}
        loading={loading}
        onPaidAmountChange={setPaidAmount}
        onClientNameChange={setClientName}
        onClientPhoneChange={setClientPhone}
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
