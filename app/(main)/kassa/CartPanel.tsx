import React from 'react'
import { Plus, Minus, Trash2, ShoppingCart, X, Save, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { NumberInput } from '@/components/ui/NumberInput'

interface CartItem {
  _id: string
  name: string
  unit: string
  salePrice: number
  costPrice: number
  stock: number
  qty: number
  price: number
}

interface CartPanelProps {
  cart: CartItem[]
  total: number
  finalTotal: number
  discount: number
  editingTotal: boolean
  editTotalValue: string
  onUpdateQty: (id: string, qty: number) => void
  onClear: () => void
  onPay: () => void
  onStartEditTotal: () => void
  onCommitEditTotal: () => void
  onEditTotalChange: (value: string) => void
  onSaveCart: () => void
  onLoadCart: () => void
  savedCartsCount: number
}

export const CartPanel = React.memo(function CartPanel({
  cart, total, finalTotal, discount, editingTotal, editTotalValue,
  onUpdateQty, onClear, onPay, onStartEditTotal, onCommitEditTotal, onEditTotalChange,
  onSaveCart, onLoadCart, savedCartsCount,
}: CartPanelProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Savat
            {cart.length > 0 && <Badge variant="secondary">{cart.length}</Badge>}
          </CardTitle>
          <div className="flex gap-1">
            {cart.length > 0 && (
              <button className="p-1.5 hover:bg-blue-50 rounded" title="Savatni saqlash" onClick={onSaveCart}>
                <Save className="w-3.5 h-3.5 text-blue-500" />
              </button>
            )}
            <button className="p-1.5 hover:bg-emerald-50 rounded relative" title="Saqlangan ro'yxatlar" onClick={onLoadCart}>
              <FolderOpen className="w-3.5 h-3.5 text-emerald-500" />
              {savedCartsCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 text-white text-[9px] rounded-full flex items-center justify-center">
                  {savedCartsCount}
                </span>
              )}
            </button>
          </div>
        </div>
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
                <button className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                  onClick={() => onUpdateQty(item._id, item.qty - 1)}>
                  <Minus className="w-4 h-4" />
                </button>
                <input className="w-16 text-center text-base border rounded px-1 py-1"
                  value={item.qty || ''} type="number" step="any" min={0}
                  onChange={e => onUpdateQty(item._id, Number(e.target.value))} />
                <button className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                  onClick={() => onUpdateQty(item._id, item.qty + 1)}>
                  <Plus className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded bg-red-100 flex items-center justify-center hover:bg-red-200 ml-1"
                  onClick={() => onUpdateQty(item._id, 0)}>
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <>
            <div className="border-t pt-3 mt-3 space-y-1">
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Asl jami:</span>
                  <span className="text-slate-400 line-through">{formatPrice(total)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Chegirma:</span>
                  <span className="text-green-600 font-medium">-{formatPrice(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Jami:</span>
                {editingTotal ? (
                  <div className="w-28" onKeyDown={e => e.key === 'Enter' && onCommitEditTotal()}>
                    <NumberInput
                      className="text-right text-sm font-bold h-7"
                      value={editTotalValue}
                      onChange={onEditTotalChange}
                      autoFocus
                      min={0}
                    />
                  </div>
                ) : (
                  <span
                    className={`font-bold cursor-pointer select-none ${discount > 0 ? 'text-green-700' : 'text-slate-800'}`}
                    onDoubleClick={onStartEditTotal}
                    title="2 marta bosing tahrirlash uchun"
                  >
                    {formatPrice(finalTotal)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onClear}>
                <X className="w-3 h-3 mr-1" /> Tozalash
              </Button>
              <Button size="sm" className="flex-1" onClick={onPay} disabled={cart.some(c => !c.qty || c.qty <= 0)}>To&apos;lash</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})
