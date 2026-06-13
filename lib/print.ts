// Thermal printer via browser window.print()
// XPrinter: set paper width to 80mm in printer settings (or 58mm)
// jsbarcode is loaded dynamically — only on print, not in page bundle

async function generateBarcode(data: string): Promise<string> {
  const { default: JsBarcode } = await import('jsbarcode')
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

async function labelHtml(product: { _id: string; name: string; salePrice: number }): Promise<string> {
  const barcodeUrl = await generateBarcode(product._id)
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

export async function printLabel(product: { _id: string; name: string; salePrice: number }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${LABEL_STYLES}</style></head><body>${await labelHtml(product)}</body></html>`
  openPrintWindow(html)
}

export async function printLabels(products: { _id: string; name: string; salePrice: number }[]) {
  if (!products.length) return
  const body = (await Promise.all(products.map(labelHtml))).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${LABEL_STYLES}</style></head><body>${body}</body></html>`
  openPrintWindow(html)
}

export interface ReceiptItem {
  productName: string
  qty: number
  unit: string
  salePrice: number
}

export async function printReceipt(data: {
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
  qrEnabled?: boolean
  qrText?: string
}) {
  const shopName = data.shopName || "Inomaka Do'kon"
  const shopPhone = data.shopPhone || ''
  const receiptFooter = data.receiptFooter || 'Rahmat! Yana tashrif buyuring.'
  const showQr = !!data.qrEnabled
  const date = data.createdAt || new Date()
  const dateStr = date.toLocaleDateString('uz-UZ') + ' ' + date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  const change = data.paid - data.total
  const debt = data.total - data.paid
  const receiptNo = data.receiptNo.toString()

  // Table format
  const tableRows = data.items.map((i, idx) => {
    const lineTotal = i.salePrice * i.qty
    return `
    <tr>
      <td style="text-align:left">${idx + 1}</td>
      <td style="text-align:left">${i.productName}</td>
      <td style="text-align:center">${i.qty} ${i.unit}</td>
      <td style="text-align:right">${i.salePrice.toLocaleString('uz-UZ')}</td>
      <td style="text-align:right;font-weight:bold">${lineTotal.toLocaleString('uz-UZ')}</td>
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
    font-size: 14px;
    width: 76mm;
    padding: 2mm;
    box-sizing: border-box;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .shop-name { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 1mm; }
  .divider { border-top: 1px dashed #000; margin: 2mm 0; }
  
  /* Table styles */
  .items-table { 
    width: 100%; 
    border-collapse: collapse; 
    margin: 2mm 0;
    font-size: 12px;
  }
  .items-table thead tr {
    border-bottom: 1px solid #000;
  }
  .items-table th {
    padding: 1mm 0;
    font-weight: bold;
    font-size: 11px;
  }
  .items-table td {
    padding: 1.5mm 1mm;
    border-bottom: 1px dotted #ccc;
  }
  .items-table tbody tr:last-child td {
    border-bottom: 1px solid #000;
  }
  
  .total-table { 
    width: 100%; 
    border-collapse: collapse; 
    margin-top: 2mm;
  }
  .total-table td { 
    padding: 1mm 0; 
    font-size: 15px;
  }
  .total-row td { 
    font-weight: bold; 
    font-size: 18px; 
    padding-top: 2mm;
  }
  
  .info { 
    display: flex; 
    justify-content: space-between; 
    margin: 1mm 0; 
    font-size: 13px; 
  }
  
  .debt-line { 
    background: #f5f5f5; 
    padding: 2mm; 
    text-align: center; 
    font-weight: bold; 
    margin: 2mm 0; 
    font-size: 16px; 
  }
  .footer {
    text-align: center;
    font-size: 12px;
    margin-top: 3mm;
  }
  .qr { text-align: center; margin-top: 3mm; }
  .qr-text { font-size: 11px; margin-bottom: 1mm; }
  .qr img { width: 30mm; height: 30mm; object-fit: contain; }
</style>
</head>
<body>
  <div class="shop-name">${shopName}</div>
  ${shopPhone ? `<div class="center" style="font-size:12px">${shopPhone}</div>` : ''}
  <div class="center" style="font-size:12px;margin:1mm 0">Chek #${receiptNo}</div>
  <div class="divider"></div>
  <div class="info"><span>Sana:</span><span>${dateStr}</span></div>
  <div class="info"><span>Kassir:</span><span>${data.cashier}</span></div>
  ${data.customer ? `<div class="info"><span>Mijoz:</span><span>${data.customer}</span></div>` : ''}
  <div class="divider"></div>
  
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:8%;text-align:left">№</th>
        <th style="width:37%;text-align:left">Mahsulot</th>
        <th style="width:18%;text-align:center">Soni</th>
        <th style="width:18%;text-align:right">Narxi</th>
        <th style="width:19%;text-align:right">Jami</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  
  <table class="total-table">
    <tbody>
      ${data.originalTotal ? `
      <tr class="total-row">
        <td>JAMI:</td>
        <td style="text-align:right">${data.originalTotal.toLocaleString('uz-UZ')}</td>
      </tr>
      <tr>
        <td style="color:#555;font-size:13px">Chegirma:</td>
        <td style="text-align:right;color:#555;font-size:13px">-${(data.originalTotal - data.total).toLocaleString('uz-UZ')}</td>
      </tr>
      <tr class="total-row">
        <td>YAKUNIY:</td>
        <td style="text-align:right">${data.total.toLocaleString('uz-UZ')}</td>
      </tr>` : `
      <tr class="total-row">
        <td>JAMI:</td>
        <td style="text-align:right">${data.total.toLocaleString('uz-UZ')}</td>
      </tr>`}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="info"><span>To'landi:</span><span class="bold">${data.paid.toLocaleString('uz-UZ')} so'm</span></div>
  ${change > 0 ? `<div class="info"><span>Qaytim:</span><span class="bold">${change.toLocaleString('uz-UZ')} so'm</span></div>` : ''}
  ${debt > 0 ? `<div class="debt-line">⚠ QARZ: ${debt.toLocaleString('uz-UZ')} so'm</div>` : ''}
  <div class="footer">${receiptFooter}<br>${shopName}</div>
  ${showQr ? `<div class="qr">
    ${data.qrText ? `<div class="qr-text">${data.qrText}</div>` : ''}
    <img src="${window.location.origin}/qr.svg" alt="QR" />
  </div>` : ''}
</body>
</html>`
  openPrintWindow(html)
}

export interface DebtPrintItem {
  productName: string
  qty: number
  unit: string
  salePrice: number
}

export interface ReturnedPrintItem {
  productName: string
  qty: number
  unit?: string
  salePrice: number
  receiptNo?: number
  returnedAt?: string
}

export function printDebtReceipt(data: {
  customerName: string
  customerPhone?: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  items: DebtPrintItem[]
  returnedItems?: ReturnedPrintItem[]
  discount?: number
  createdAt: string
  shopName?: string
}) {
  const shopName = data.shopName || "Inomaka Do'kon"
  const date = new Date(data.createdAt).toLocaleDateString('uz-UZ')

  // Tovarlar asl narxi jami
  const itemsTotal = data.items.reduce((s, i) => s + i.salePrice * i.qty, 0)
  // Chegirma: agar discount berilgan bo'lsa ishlatamiz, aks holda totalAmount bilan farqdan hisoblaymiz
  const discount = data.discount ?? Math.max(0, itemsTotal - data.totalAmount)

  const itemRows = data.items.map((i, idx) => {
    const lineTotal = i.salePrice * i.qty
    return `
    <tr>
      <td style="text-align:left">${idx + 1}</td>
      <td style="text-align:left">${i.productName}</td>
      <td style="text-align:center">${i.qty} ${i.unit}</td>
      <td style="text-align:right">${i.salePrice.toLocaleString('uz-UZ')}</td>
      <td style="text-align:right;font-weight:bold">${lineTotal.toLocaleString('uz-UZ')}</td>
    </tr>`
  }).join('')

  const returnedGroups = new Map<string, ReturnedPrintItem[]>()
  for (const item of (data.returnedItems ?? [])) {
    const key = item.receiptNo ? `Chek #${item.receiptNo}` : 'Qaytarilgan'
    if (!returnedGroups.has(key)) returnedGroups.set(key, [])
    returnedGroups.get(key)!.push(item)
  }
  let returnedRows = ''
  for (const [groupTitle, groupItems] of returnedGroups) {
    returnedRows += `<tr><td colspan="5" class="ret-group">${groupTitle}</td></tr>`
    returnedRows += groupItems.map(i => {
      const lineTotal = Math.abs(i.salePrice) * Math.abs(i.qty)
      const unit = i.unit || 'dona'
      return `<tr class="ret-row">
      <td style="text-align:left">↩</td>
      <td style="text-align:left">${i.productName}</td>
      <td style="text-align:center">${i.qty} ${unit}</td>
      <td style="text-align:right">${i.salePrice.toLocaleString('uz-UZ')}</td>
      <td style="text-align:right;font-weight:bold">-${lineTotal.toLocaleString('uz-UZ')}</td>
    </tr>`
    }).join('')
  }

  const returnedTotal = (data.returnedItems ?? []).reduce((s, i) => s + Math.abs(i.salePrice) * Math.abs(i.qty), 0)

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
    font-size: 16px;
    width: 76mm;
    padding: 2mm;
    box-sizing: border-box;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .title { text-align: center; font-size: 18px; font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 2mm 0; }
  .items-table { width:100%; border-collapse:collapse; margin:2mm 0; font-size:13px; }
  .items-table thead tr { border-bottom:1px solid #000; }
  .items-table th { padding:1mm 0; font-weight:bold; font-size:12px; }
  .items-table td { padding:1.5mm 1mm; border-bottom:1px dotted #ccc; vertical-align:top; word-break:break-word; }
  .items-table tbody tr:last-child td { border-bottom:1px solid #000; }
  .ret-row td { color:#cc0000; background:#fff3f3; }
  .ret-group { color:#cc0000; font-weight:bold; font-size:12px; padding-top:1.5mm !important; }
  .info { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; }
  .info-red { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; color: #cc0000; }
  .info-green { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; color: #007700; }
  .debt-total { text-align: center; font-size: 18px; font-weight: bold; margin: 2mm 0; padding: 2mm; background: #f5f5f5; }
  .customer-name { text-align: center; font-size: 16px; font-weight: bold; margin: 2mm 0; }
  .ret-section { text-align:center; font-weight:bold; color:#cc0000; padding:1.5mm 0 !important; border-top:1px solid #cc0000; border-bottom:1px solid #cc0000; }
</style>
</head>
<body>
  <div class="title">${shopName}</div>
  <div class="center" style="font-size:14px;font-weight:bold;margin:1mm 0">QARZ CHEKI</div>
  <div class="divider"></div>
  <div class="customer-name">${data.customerName}</div>
  ${data.customerPhone ? `<div class="info"><span>Tel:</span><span>${data.customerPhone}</span></div>` : ''}
  <div class="info"><span>Sana:</span><span>${date}</span></div>
  <div class="divider"></div>
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:8%;text-align:left">№</th>
        <th style="width:37%;text-align:left">Mahsulot</th>
        <th style="width:18%;text-align:center">Soni</th>
        <th style="width:18%;text-align:right">Narxi</th>
        <th style="width:19%;text-align:right">Jami</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${returnedTotal > 0 ? `<tr><td colspan="5" class="ret-section">⚠ QAYTARILGAN TOVARLAR ⚠</td></tr>${returnedRows}` : ''}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="info"><span>Tovarlar jami:</span><span>${itemsTotal.toLocaleString('uz-UZ')} so'm</span></div>
  ${returnedTotal > 0 ? `<div class="info-red"><span>Qaytarilgan:</span><span>-${returnedTotal.toLocaleString('uz-UZ')} so'm</span></div>` : ''}
  ${discount > 0 ? `<div class="info-green"><span>Chegirma:</span><span>-${discount.toLocaleString('uz-UZ')} so'm</span></div>` : ''}
  <div class="info bold"><span>Jami qarz:</span><span>${data.totalAmount.toLocaleString('uz-UZ')} so'm</span></div>
  <div class="info"><span>To'langan:</span><span>${data.paidAmount.toLocaleString('uz-UZ')} so'm</span></div>
  <div class="debt-total">QARZ: ${data.remainingAmount.toLocaleString('uz-UZ')} so'm</div>
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

  let done = false
  const doPrint = () => {
    if (done) return
    done = true
    win.print()
    win.close()
  }

  // Wait for images (QR, barcode) to finish loading before printing
  const imgs = Array.from(win.document.images)
  const pending = imgs.filter(img => !img.complete)
  if (pending.length) {
    let left = pending.length
    const onDone = () => { if (--left === 0) doPrint() }
    pending.forEach(img => {
      img.addEventListener('load', onDone, { once: true })
      img.addEventListener('error', onDone, { once: true })
    })
    setTimeout(doPrint, 2000) // fallback
  } else {
    setTimeout(doPrint, 300)
  }
}
