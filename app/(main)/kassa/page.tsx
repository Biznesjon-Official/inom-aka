'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Search, Plus, Minus, Trash2, ShoppingCart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import { printReceipt } from '@/lib/print'
import SalesLog from './SalesLog'

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

export default function KassaPage() {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [payDialog, setPayDialog] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(async () => {
    const res = await fetch(`/api/products?search=${encodeURIComponent(search)}`)
    setProducts(await res.json())
  }, [search])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  function getItemPrice(p: Product, qty: number) {
    if (p.discountPrice && p.discountThreshold && qty >= p.discountThreshold) return p.discountPrice
    return p.salePrice
  }

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(c => c._id === product._id)
      if (existing) {
        const newQty = existing.qty + 1
        return prev.map(c => c._id === product._id ? { ...c, qty: newQty, price: getItemPrice(product, newQty) } : c)
      }
      return [...prev, { ...product, qty: 1, price: getItemPrice(product, 1) }]
    })
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter(c => c._id !== id)); return }
    setCart(prev => prev.map(c => c._id === id ? { ...c, qty, price: getItemPrice(c, qty) } : c))
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const paid = Number(paidAmount) || 0
  const change = paid - total
  const debt = total - paid
  const isDebt = paid < total
  const isOverpaid = paid > total

  function openPayDialog() {
    setPaidAmount('')
    setClientName('')
    setClientPhone('')
    setPayDialog(true)
  }

  async function handleCheckout() {
    if (cart.length === 0) return toast.error('Savat bo\'sh')
    if (!paidAmount || paid < 0) return toast.error('To\'langan summani kiriting')
    if (isDebt && !clientName.trim()) return toast.error('Qarz bo\'lganda mijoz ismi majburiy')
    if (isDebt && !clientPhone.trim()) return toast.error('Qarz bo\'lganda telefon raqam majburiy')

    setLoading(true)

    // Find or create customer if name is given
    let customerId: string | undefined
    if (clientName.trim()) {
      const existing = await fetch(`/api/customers?search=${encodeURIComponent(clientName.trim())}`)
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
        const c = await created.json()
        customerId = c._id
      }
    }

    const actualPaid = Math.min(paid, total) // overpaid case — record as total
    const paymentType = paid >= total ? 'full' : paid > 0 ? 'partial' : 'debt'

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
        total,
        paid: actualPaid,
        cashier: session?.user.id,
        customer: customerId,
        paymentType,
      }),
    })
    setLoading(false)

    if (!res.ok) return toast.error('Xato yuz berdi')

    // Print receipt
    await printReceipt({
      items: cart.map(c => ({ productName: c.name, qty: c.qty, unit: c.unit, salePrice: c.price })),
      total,
      paid: actualPaid,
      cashier: session?.user?.name || 'Kassir',
      customer: clientName.trim() || undefined,
      paymentType,
      createdAt: new Date(),
    })

    if (isDebt) {
      toast.success(`Sotuv saqlandi. Qarz: ${formatPrice(debt)}`)
    } else if (isOverpaid) {
      toast.success(`Sotuv saqlandi. Qaytim: ${formatPrice(-debt)}`)
    } else {
      toast.success('Sotuv muvaffaqiyatli!')
    }

    setCart([])
    setPayDialog(false)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Products panel */}
      <div className="flex-1 space-y-4">
        <h1 className="text-xl font-bold text-slate-800">Kassa</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Mahsulot qidirish..." className="pl-9" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {products.map(p => (
            <button key={p._id} onClick={() => addToCart(p)}
              className={`text-left bg-white rounded-xl border transition-all overflow-hidden ${(p.stock ?? 0) <= 0 ? 'border-red-200 opacity-60' : 'border-slate-200 hover:border-blue-400 hover:shadow-sm'}`}>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.name} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 bg-slate-100 flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div className="p-2">
                <div className="text-sm font-medium text-slate-800 line-clamp-2 mb-1">{p.name}</div>
                {p.category && <div className="text-xs text-slate-400 mb-1">{p.category.name}</div>}
                <div className="text-blue-600 font-bold text-sm">{formatPrice(p.salePrice)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">/{p.unit}</span>
                  <span className={`text-xs font-medium ${(p.stock ?? 0) <= 0 ? 'text-red-500' : (p.stock ?? 0) <= 5 ? 'text-orange-500' : 'text-slate-400'}`}>
                    {p.stock ?? 0} {p.unit}
                  </span>
                </div>
                {p.discountPrice && p.discountThreshold && (
                  <div className="text-xs text-green-600 mt-0.5">{p.discountThreshold}+: {formatPrice(p.discountPrice)}</div>
                )}
              </div>
            </button>
          ))}
          {products.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-8">Mahsulot topilmadi</div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 xl:w-96">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Savat
              {cart.length > 0 && <Badge variant="secondary">{cart.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cart.length === 0 && <div className="text-center text-slate-400 py-6 text-sm">Savat bo&apos;sh</div>}

            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {cart.map(item => (
                <div key={item._id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.name}</div>
                    <div className="text-xs text-slate-500">{formatPrice(item.price)}/{item.unit}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                      onClick={() => updateQty(item._id, item.qty - 1)}>
                      <Minus className="w-3 h-3" />
                    </button>
                    <input className="w-12 text-center text-sm border rounded px-1 py-0.5"
                      value={item.qty} type="number" min={0}
                      onChange={e => updateQty(item._id, Number(e.target.value))} />
                    <button className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                      onClick={() => updateQty(item._id, item.qty + 1)}>
                      <Plus className="w-3 h-3" />
                    </button>
                    <button className="w-6 h-6 rounded bg-red-100 flex items-center justify-center hover:bg-red-200 ml-1"
                      onClick={() => updateQty(item._id, 0)}>
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {cart.length > 0 && (
              <>
                <div className="border-t pt-3 mt-3 flex justify-between text-sm">
                  <span className="text-slate-500">Jami:</span>
                  <span className="font-bold text-slate-800">{formatPrice(total)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setCart([])}>
                    <X className="w-3 h-3 mr-1" /> Tozalash
                  </Button>
                  <Button size="sm" className="flex-1" onClick={openPayDialog}>To&apos;lash</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <SalesLog cashierId={session?.user.role === 'worker' ? session.user.id : undefined} />
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payDialog} onOpenChange={setPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>To&apos;lov</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Total */}
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500 mb-1">Jami summa</div>
              <div className="text-2xl font-bold text-slate-800">{formatPrice(total)}</div>
            </div>

            {/* Customer info */}
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>Mijoz ismi {isDebt && <span className="text-red-500">*</span>}</Label>
                <Input placeholder="Ism (ixtiyoriy)" value={clientName}
                  onChange={e => setClientName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon raqam {isDebt && <span className="text-red-500">*</span>}</Label>
                <Input placeholder="+998 XX XXX XX XX" value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)} />
              </div>
            </div>

            {/* Paid amount */}
            <div className="space-y-1.5">
              <Label>Berilgan pul *</Label>
              <Input
                type="number"
                placeholder="Summa kiriting"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Status preview */}
            {paidAmount && paid >= 0 && (
              <div className={`rounded-lg p-3 text-sm font-medium text-center ${
                paid >= total
                  ? 'bg-green-50 text-green-700'
                  : 'bg-orange-50 text-orange-700'
              }`}>
                {paid >= total ? (
                  paid > total
                    ? `✓ To'liq. Qaytim: ${formatPrice(paid - total)}`
                    : `✓ To'liq to'landi`
                ) : (
                  `⚠ Qarz: ${formatPrice(total - paid)}`
                )}
              </div>
            )}

            <Button className="w-full" onClick={handleCheckout} disabled={loading}>
              {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
