import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils'

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
            <div className="space-y-1.5">
              <Label>Mijoz ismi {isDebt && <span className="text-red-500">*</span>}</Label>
              <Input placeholder="Ism (ixtiyoriy)" value={clientName}
                onChange={e => onClientNameChange(e.target.value)} />
            </div>
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
