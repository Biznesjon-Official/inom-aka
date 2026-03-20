// Thermal printer via browser window.print()
// XPrinter: set paper width to 80mm in printer settings (or 58mm)
import JsBarcode from 'jsbarcode'

function generateBarcode(data: string): string {
  const canvas = document.createElement('canvas')
  JsBarcode(canvas, data, {
    format: 'CODE128',
    width: 2,
    height: 40,
    displayValue: true,
    fontSize: 12,
    margin: 2,
  })
  return canvas.toDataURL('image/png')
}

function labelHtml(product: { _id: string; name: string; salePrice: number }): string {
  const barcodeUrl = generateBarcode(product._id)
  return `<div class="label">
  <div class="name">${product.name}</div>
  <div class="price">${Number(product.salePrice).toLocaleString('uz-UZ')} so'm</div>
  <div class="barcode"><img src="${barcodeUrl}" alt="barcode" /></div>
</div>`
}

const LABEL_STYLES = `
  @media print {
    @page { size: 58mm auto; margin: 0; }
    body { margin: 0; }
  }
  body { font-family: 'Courier New', monospace; width: 58mm; }
  .label { width: 54mm; padding: 2mm; box-sizing: border-box; }
  .name { font-weight: bold; font-size: 13px; text-align: center; word-break: break-word; margin-bottom: 2mm; line-height: 1.3; }
  .price { font-size: 22px; font-weight: bold; text-align: center; margin: 2mm 0; }
  .barcode { text-align: center; }
  .barcode img { width: 50mm; height: auto; }
`

export function printLabel(product: { _id: string; name: string; salePrice: number }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${LABEL_STYLES}</style></head><body>${labelHtml(product)}</body></html>`
  openPrintWindow(html)
}

export function printLabels(products: { _id: string; name: string; salePrice: number }[]) {
  if (!products.length) return
  const body = products.map(labelHtml).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${LABEL_STYLES}</style></head><body>${body}</body></html>`
  openPrintWindow(html)
}

export interface ReceiptItem {
  productName: string
  qty: number
  unit: string
  salePrice: number
}

export function printReceipt(data: {
  receiptNo: number
  items: ReceiptItem[]
  total: number
  paid: number
  cashier: string
  customer?: string
  paymentType: string
  createdAt?: Date
  originalTotal?: number
  shopName?: string
  shopPhone?: string
  receiptFooter?: string
}) {
  const shopName = data.shopName || "Inomaka Do'kon"
  const shopPhone = data.shopPhone || ''
  const receiptFooter = data.receiptFooter || 'Rahmat! Yana tashrif buyuring.'
  const date = data.createdAt || new Date()
  const dateStr = date.toLocaleDateString('uz-UZ') + ' ' + date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  const change = data.paid - data.total
  const debt = data.total - data.paid
  const receiptNo = data.receiptNo.toString()

  const itemsHtml = data.items.map(i => {
    const lineTotal = i.salePrice * i.qty
    return `
    <tr>
      <td>${i.productName}</td>
      <td style="text-align:right">${i.qty} ${i.unit}</td>
      <td style="text-align:right">${i.salePrice.toLocaleString('uz-UZ')}</td>
      <td style="text-align:right">${lineTotal.toLocaleString('uz-UZ')}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @media print {
    @page { size: 80mm auto; margin: 2mm; }
    body { margin: 0; }
  }
  body {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    width: 76mm;
    padding: 2mm;
    box-sizing: border-box;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .shop-name { text-align: center; font-size: 15px; font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; border-bottom: 1px solid #000; padding: 1mm 0; }
  td { padding: 1mm 0; vertical-align: top; }
  .total-row td { font-weight: bold; border-top: 1px dashed #000; padding-top: 2mm; font-size: 13px; }
  .info { display: flex; justify-content: space-between; margin: 1mm 0; font-size: 10px; }
  .debt-line { background: #f5f5f5; padding: 1mm 2mm; text-align: center; font-weight: bold; margin: 2mm 0; }
  .footer { text-align: center; font-size: 10px; margin-top: 3mm; }
</style>
</head>
<body>
  <div class="shop-name">${shopName}</div>
  ${shopPhone ? `<div class="center" style="font-size:10px">${shopPhone}</div>` : ''}
  <div class="center" style="font-size:10px">Chek #${receiptNo}</div>
  <div class="divider"></div>
  <div class="info"><span>Sana:</span><span>${dateStr}</span></div>
  <div class="info"><span>Kassir:</span><span>${data.cashier}</span></div>
  ${data.customer ? `<div class="info"><span>Mijoz:</span><span>${data.customer}</span></div>` : ''}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Mahsulot</th>
        <th style="text-align:right">Miqdor</th>
        <th style="text-align:right">Narx</th>
        <th style="text-align:right">Jami</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
      ${data.originalTotal ? `
      <tr class="total-row">
        <td colspan="3">JAMI:</td>
        <td style="text-align:right">${data.originalTotal.toLocaleString('uz-UZ')}</td>
      </tr>
      <tr>
        <td colspan="3" style="color:#555">Chegirma:</td>
        <td style="text-align:right;color:#555">-${(data.originalTotal - data.total).toLocaleString('uz-UZ')}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3">YAKUNIY:</td>
        <td style="text-align:right">${data.total.toLocaleString('uz-UZ')}</td>
      </tr>` : `
      <tr class="total-row">
        <td colspan="3">JAMI:</td>
        <td style="text-align:right">${data.total.toLocaleString('uz-UZ')}</td>
      </tr>`}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="info"><span>To'landi:</span><span class="bold">${data.paid.toLocaleString('uz-UZ')} so'm</span></div>
  ${change > 0 ? `<div class="info"><span>Qaytim:</span><span class="bold">${change.toLocaleString('uz-UZ')} so'm</span></div>` : ''}
  ${debt > 0 ? `<div class="debt-line">⚠ QARZ: ${debt.toLocaleString('uz-UZ')} so'm</div>` : ''}
  <div class="footer">${receiptFooter}<br>${shopName}</div>
</body>
</html>`
  openPrintWindow(html)
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}
