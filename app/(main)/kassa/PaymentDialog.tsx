import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatPrice } from '@/lib/utils'
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
  loading: boolean
  cart: CartItem[]
  onTotalChange: (value: number | null) => void
  onCheckout: (payments: SalePayment[], extra: { ustaId?: string; debtorName?: string; debtorPhone?: string }) => void
}

interface Usta {
  _id: string
  name: string
  cashbackPercent: number
}

function UstaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [ustalar, setUstalar] = useState<Usta[]>([])

  useEffect(() => {
    fetch('/api/customers').then(r => r.ok ? r.json() : []).then(setUstalar)
  }, [])

  return (
    <div className="space-y-1.5">
      <Label>Usta (ixtiyoriy)</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Usta tanlang..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Ustasiz</SelectItem>
          {ustalar.map(u => (
            <SelectItem key={u._id} value={u._id}>
              {u.name} ({u.cashbackPercent}%)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = { cash: 'Naqd', card: 'Karta', terminal: 'Terminal' }

export const PaymentDialog = React.memo(function PaymentDialog({
  open, onOpenChange, total, finalTotal, discount,
  loading, cart,
  onTotalChange, onCheckout,
}: PaymentDialogProps) {
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [terminalAmount, setTerminalAmount] = useState('')
  const [editingTotal, setEditingTotal] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [ustaId, setUstaId] = useState('none')
  const [debtorName, setDebtorName] = useState('')
  const [debtorPhone, setDebtorPhone] = useState('')
  const [showDebtorSuggestions, setShowDebtorSuggestions] = useState(false)

  const cashNum = Number(cashAmount) || 0
  const cardNum = Number(cardAmount) || 0
  const terminalNum = Number(terminalAmount) || 0
  const paidTotal = cashNum + cardNum + terminalNum
  const remaining = finalTotal - paidTotal
  const isDebt = remaining > 0
  const costTotal = cart.reduce((s, c) => s + c.costPrice * c.qty, 0)
  const profit = finalTotal - costTotal

  const [debtors, setDebtors] = useState<{name: string, phone: string}[]>([])
  
  // Filter debtors based on input
  const filteredDebtors = debtorName.trim().length > 0
    ? debtors.filter(d => d.name.toLowerCase().includes(debtorName.toLowerCase()))
    : []

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setCashAmount('')
      setCardAmount('')
      setTerminalAmount('')
      setEditingTotal(false)
      setUstaId('none')
      setDebtorName('')
      setDebtorPhone('')
      setShowDebtorSuggestions(false)
      fetch('/api/debts/debtors').then(r => r.json()).then(setDebtors).catch(() => {})
    }
  }, [open])

  function fillFull(method: 'cash' | 'card' | 'terminal') {
    const currentRemaining = finalTotal - (
      (method === 'cash' ? 0 : cashNum) +
      (method === 'card' ? 0 : cardNum) +
      (method === 'terminal' ? 0 : terminalNum)
    )
    if (currentRemaining <= 0) return
    const val = String(currentRemaining)
    if (method === 'cash') setCashAmount(val)
    else if (method === 'card') setCardAmount(val)
    else setTerminalAmount(val)
  }

  function buildPayments(): SalePayment[] {
    const payments: SalePayment[] = []
    if (cashNum > 0) payments.push({ method: 'cash', amount: cashNum })
    if (cardNum > 0) payments.push({ method: 'card', amount: cardNum })
    if (terminalNum > 0) payments.push({ method: 'terminal', amount: terminalNum })
    return payments
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

  const paymentInputs: { key: 'cash' | 'card' | 'terminal'; label: string; emoji: string; value: string; setter: (v: string) => void; maxLimit: number }[] = [
    { key: 'cash', label: 'Naqd', emoji: '\uD83D\uDCB5', value: cashAmount, setter: setCashAmount, maxLimit: finalTotal - cardNum - terminalNum },
    { key: 'card', label: 'Karta', emoji: '\uD83D\uDCB3', value: cardAmount, setter: setCardAmount, maxLimit: finalTotal - cashNum - terminalNum },
    { key: 'terminal', label: 'Terminal', emoji: '\uD83D\uDCF1', value: terminalAmount, setter: setTerminalAmount, maxLimit: finalTotal - cashNum - cardNum },
  ]

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

          {/* 3 payment inputs */}
          <div className="space-y-2.5">
            {paymentInputs.map(({ key, label, emoji, value, setter, maxLimit }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-sm w-20 text-slate-600 flex items-center gap-1.5">
                  <span>{emoji}</span> {label}
                </span>
                <div className="flex-1">
                  <NumberInput value={value} onChange={setter} placeholder="0" min={0} max={Math.max(0, maxLimit)} />
                </div>
                <Button size="sm" variant="outline" className="text-xs px-3 shrink-0"
                  onClick={() => fillFull(key)}>
                  To&apos;liq
                </Button>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className={`rounded-lg p-3 text-sm font-medium text-center ${
            remaining <= 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
          }`}>
            {remaining <= 0
              ? paidTotal > finalTotal
                ? `To'liq. Qaytim: ${formatPrice(paidTotal - finalTotal)}`
                : paidTotal > 0 ? `To'liq to'landi` : `To'lov kiritilmagan`
              : `Qarz: ${formatPrice(remaining)}`
            }
          </div>

          <UstaSelect value={ustaId} onChange={setUstaId} />

          {isDebt && (
            <div className="space-y-2">
              <div className="space-y-1.5 relative">
                <Label>Qarzdor ismi <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="Ism familiya" 
                  value={debtorName} 
                  onChange={e => {
                    setDebtorName(e.target.value)
                    setShowDebtorSuggestions(true)
                  }}
                  onFocus={() => setShowDebtorSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDebtorSuggestions(false), 200)}
                />
                {showDebtorSuggestions && filteredDebtors.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredDebtors.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 border-b last:border-0 text-sm"
                        onClick={() => {
                          setDebtorName(d.name)
                          setDebtorPhone(d.phone || '')
                          setShowDebtorSuggestions(false)
                        }}
                      >
                        <div className="font-medium text-slate-800">{d.name}</div>
                        {d.phone && <div className="text-xs text-slate-500">{d.phone}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Telefon raqam <span className="text-red-500">*</span></Label>
                <Input placeholder="+998 XX XXX XX XX" value={debtorPhone} onChange={e => setDebtorPhone(e.target.value)} />
              </div>
            </div>
          )}

          <Button className="w-full"
            onClick={() => onCheckout(buildPayments(), {
              ustaId: ustaId !== 'none' ? ustaId : undefined,
              debtorName: debtorName.trim() || undefined,
              debtorPhone: debtorPhone.trim() || undefined,
            })}
            disabled={loading || (isDebt && (!debtorName.trim() || !debtorPhone.trim()))}>
            {loading ? 'Saqlanmoqda...' : paidTotal <= 0 ? 'Qarzga berish' : isDebt ? 'Qisman to\'lov' : 'Tasdiqlash'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
