import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  finalTotal: number
  discount: number
  paidAmount: string
  clientName: string
  clientPhone: string
  loading: boolean
  onPaidAmountChange: (value: string) => void
  onClientNameChange: (value: string) => void
  onClientPhoneChange: (value: string) => void
  onCheckout: () => void
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

export const PaymentDialog = React.memo(function PaymentDialog({
  open, onOpenChange, total, finalTotal, discount,
  paidAmount, clientName, clientPhone, loading,
  onPaidAmountChange, onClientNameChange, onClientPhoneChange, onCheckout,
}: PaymentDialogProps) {
  const paid = Number(paidAmount) || 0
  const isDebt = paid < finalTotal

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
            <div className="text-2xl font-bold text-slate-800">{formatPrice(finalTotal)}</div>
            {discount > 0 && (
              <div className="text-xs text-green-600 mt-1">Chegirma: -{formatPrice(discount)}</div>
            )}
          </div>

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

          <div className="space-y-1.5">
            <Label>Berilgan pul *</Label>
            <Input
              type="number"
              placeholder="Summa kiriting"
              value={paidAmount}
              onChange={e => onPaidAmountChange(e.target.value)}
              autoFocus
            />
          </div>

          {paidAmount && paid >= 0 && (
            <div className={`rounded-lg p-3 text-sm font-medium text-center ${
              paid >= finalTotal
                ? 'bg-green-50 text-green-700'
                : 'bg-orange-50 text-orange-700'
            }`}>
              {paid >= finalTotal ? (
                paid > finalTotal
                  ? `✓ To'liq. Qaytim: ${formatPrice(paid - finalTotal)}`
                  : `✓ To'liq to'landi`
              ) : (
                `⚠ Qarz: ${formatPrice(finalTotal - paid)}`
              )}
            </div>
          )}

          <Button className="w-full" onClick={onCheckout} disabled={loading}>
            {loading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
