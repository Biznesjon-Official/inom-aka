'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { ScanLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BarcodeScannerProps {
  onScan: (code: string) => void
}

export default function BarcodeScanner({ onScan }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScanRef = useRef('')
  const lastScanTimeRef = useRef(0)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {
        // Already stopped
      }
      scannerRef.current = null
    }
  }, [])

  const handleClose = useCallback(() => {
    stopScanner()
    setOpen(false)
  }, [stopScanner])

  useEffect(() => {
    if (!open) return

    const scanner = new Html5Qrcode('barcode-reader')
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 120 } },
      (decodedText) => {
        const now = Date.now()
        // Prevent duplicate scans within 2 seconds
        if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 2000) return
        lastScanRef.current = decodedText
        lastScanTimeRef.current = now
        onScan(decodedText)
      },
      () => { /* ignore scan errors */ }
    ).catch(() => {
      // Camera permission denied or not available
    })

    return () => { stopScanner() }
  }, [open, onScan, stopScanner])

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <ScanLine className="w-4 h-4" />
        Skaner
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-medium text-sm text-slate-700">Barcode skanerlash</span>
          <button onClick={handleClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <div ref={containerRef} className="relative">
          <div id="barcode-reader" className="w-full" />
        </div>
        <div className="p-3 text-center text-xs text-slate-500">
          Barcode ni kameraga ko&apos;rsating
        </div>
      </div>
    </div>
  )
}
