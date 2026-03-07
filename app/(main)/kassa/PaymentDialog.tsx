import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks'
import { NumberInput } from '@/components/ui/NumberInput'

interface CartItem {
  _id: string
  costPrice: number
  qty: number
  price: number
}

export interface SalePayment {
  method: 'cash' | 'card' | 'terminal'
  amount: number
}

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  finalTotal: number
  discount: number
  clientName: string
  clientPhone: string
  loading: boolean
  cart: CartItem[]
  onClientNameChange: (value: string) => void
  onClientPhoneChange: (value: string) => void
  onTotalChange: (value: number | null) => void
  onCheckout: (payments: SalePayment[]) => void
}

interface CustomerSuggestion {
  _id: string
  name: string
  phone?: string
}

function CustomerAutocomplete({ value, phone, onChange, onPhoneChange, required }: {
  value: string; phone: string; onChange: (v: string) => void; onPhoneChange: (v: string) => void; required: boolean
}) {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debouncedSearch = useDebounce(value, 200)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) { setSuggestions([]); return }
    fetch(`/api/customers?search=${encodeURIComponent(debouncedSearch)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: CustomerSuggestion[]) => { setSuggestions(data.slice(0, 5)); setShowSuggestions(true) })
  }, [debouncedSearch])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectCustomer(c: CustomerSuggestion) {
    onChange(c.name)
    if (c.phone) onPhoneChange(c.phone)
    setShowSuggestions(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="space-y-1.5">
        <Label>Mijoz ismi {required && <span className="text-red-500">*</span>}</Label>
        <Input placeholder="Ism qidirish..." value={value}
          onChange={e => { onChange(e.target.value); setShowSuggestions(true) }}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)} />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map(c => (
            <button key={c._id} type="button" className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
              onClick={() => selectCustomer(c)}>
              <div className="font-medium text-slate-800">{c.name}</div>
              {c.phone && <div className="text-xs text-slate-400">{c.phone}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = { cash: 'Naqd', card: 'Karta', terminal: 'Terminal' }

export const PaymentDialog = React.memo(function PaymentDialog({
  open, onOpenChange, total, finalTotal, discount,
  clientName, clientPhone, loading, cart,
  onClientNameChange, onClientPhoneChange, onTotalChange, onCheckout,
}: PaymentDialogProps) {
  const [payments, setPayments] = useState<SalePayment[]>([])
  const [currentMethod, setCurrentMethod] = useState<'cash' | 'card' | 'terminal'>('cash')
  const [currentAmount, setCurrentAmount] = useState('')
  const [editingTotal, setEditingTotal] = useState(false)
  const [editValue, setEditValue] = useState('')

  const paidTotal = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = finalTotal - paidTotal
  const isDebt = remaining > 0
  const costTotal = cart.reduce((s, c) => s + c.costPrice * c.qty, 0)
  const profit = finalTotal - costTotal

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setPayments([])
      setCurrentAmount('')
      setCurrentMethod('cash')
      setEditingTotal(false)
    }
  }, [open])

  function addPayment() {
    const amt = Number(currentAmount)
    if (!amt || amt <= 0) return
    setPayments(prev => [...prev, { method: currentMethod, amount: amt }])
    setCurrentAmount('')
  }

  function removePayment(idx: number) {
    setPayments(prev => prev.filter((_, i) => i !== idx))
  }

  function payFull(method: 'cash' | 'card' | 'terminal') {
    if (remaining <= 0) return
    setPayments(prev => [...prev, { method, amount: remaining }])
    setCurrentAmount('')
  }

  function startEditTotal() {
    setEditValue(String(finalTotal))
    setEditingTotal(true)
  }

  function commitEditTotal() {
    const val = Number(editValue)
    if (val > 0 && val !== total) {
      onTotalChange(val)
    } else {
      onTotalChange(null)
    }
    setEditingTotal(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>To&apos;lov</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500 mb-1">Jami summa</div>
            {discount > 0 && (
              <div className="text-sm text-slate-400 line-through">{formatPrice(total)}</div>
            )}
            {editingTotal ? (
              <div className="flex justify-center" onKeyDown={e => e.key === 'Enter' && commitEditTotal()}>
                <NumberInput
                  className="text-center text-2xl font-bold w-48 h-10"
                  value={editValue}
                  onChange={setEditValue}
                  autoFocus
                  min={0}
                />
              </div>
            ) : (
              <div className="text-2xl font-bold text-slate-800 cursor-pointer" onClick={startEditTotal} title="Bosing tahrirlash uchun">
                {formatPrice(finalTotal)}
              </div>
            )}
            {editingTotal && (
              <Button size="sm" variant="outline" className="mt-2" onClick={commitEditTotal}>Tasdiqlash</Button>
            )}
            {discount > 0 && (
              <div className="text-xs text-green-600 mt-1">Chegirma: -{formatPrice(discount)}</div>
            )}
            <div className={`text-xs mt-1 font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profit >= 0 ? `Foyda: ${formatPrice(profit)}` : `Zarar: -${formatPrice(Math.abs(profit))}`}
            </div>
          </div>

          {/* Quick pay buttons */}
          {remaining > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">To&apos;liq to&apos;lash:</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={() => payFull('cash')} className="text-xs">
                  💵 Naqd
                </Button>
                <Button size="sm" variant="outline" onClick={() => payFull('card')} className="text-xs">
                  💳 Karta
                </Button>
                <Button size="sm" variant="outline" onClick={() => payFull('terminal')} className="text-xs">
                  📱 Terminal
                </Button>
              </div>
            </div>
          )}

          {/* Split payment input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Qo&apos;shimcha to&apos;lov:</Label>
            <div className="flex gap-2">
              <select className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                value={currentMethod} onChange={e => setCurrentMethod(e.target.value as 'cash' | 'card' | 'terminal')}>
                <option value="cash">Naqd</option>
                <option value="card">Karta</option>
                <option value="terminal">Terminal</option>
              </select>
              <div className="flex-1" onKeyDown={e => e.key === 'Enter' && addPayment()}>
                <NumberInput value={currentAmount} onChange={setCurrentAmount} placeholder="Summa" min={0} />
              </div>
              <Button size="sm" onClick={addPayment}>+</Button>
            </div>
          </div>

          {/* Payments list */}
          {payments.length > 0 && (
            <div className="space-y-1">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                  <span className="text-slate-600">{METHOD_LABELS[p.method]}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{formatPrice(p.amount)}</span>
                    <button className="text-red-400 hover:text-red-600" onClick={() => removePayment(i)}>✕</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-sm font-medium pt-1">
                <span className="text-slate-500">To&apos;langan:</span>
                <span className="text-slate-800">{formatPrice(paidTotal)}</span>
              </div>
            </div>
          )}

          {/* Status */}
          {payments.length > 0 && (
            <div className={`rounded-lg p-3 text-sm font-medium text-center ${
              remaining <= 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {remaining <= 0
                ? paidTotal > finalTotal
                  ? `✓ To'liq. Qaytim: ${formatPrice(paidTotal - finalTotal)}`
                  : `✓ To'liq to'landi`
                : `⚠ Qarz: ${formatPrice(remaining)}`
              }
            </div>
          )}

          <div className="space-y-2">
            <CustomerAutocomplete
              value={clientName}
              phone={clientPhone}
              onChange={onClientNameChange}
              onPhoneChange={onClientPhoneChange}
              required={isDebt}
            />
            <div className="space-y-1.5">
              <Label>Telefon raqam {isDebt && <span className="text-red-500">*</span>}</Label>
              <Input placeholder="+998 XX XXX XX XX" value={clientPhone}
                onChange={e => onClientPhoneChange(e.target.value)} />
            </div>
          </div>

          <Button className="w-full" onClick={() => onCheckout(payments)} disabled={loading || payments.length === 0}>
            {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
