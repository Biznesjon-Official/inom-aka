// Thermal printer via browser window.print()
// XPrinter: set paper width to 80mm in printer settings (or 58mm)
// jsbarcode/qrcode are loaded dynamically — only on print, not in page bundle

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

async function generateQRCode(data: string): Promise<string> {
  try {
    const { default: QRCode } = await import('qrcode')
    return await QRCode.toDataURL(data, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
  } catch (err) {
    console.error('QR Code generation error:', err)
    return ''
  }
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
  bankCard?: string
}) {
  const shopName = data.shopName || "Inomaka Do'kon"
  const shopPhone = data.shopPhone || ''
  const receiptFooter = data.receiptFooter || 'Rahmat! Yana tashrif buyuring.'
  const date = data.createdAt || new Date()
  const dateStr = date.toLocaleDateString('uz-UZ') + ' ' + date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  const change = data.paid - data.total
  const debt = data.total - data.paid
  const receiptNo = data.receiptNo.toString()

  // QR Code yaratish (agar bank karta ma'lumoti bo'lsa)
  let qrCodeHtml = ''
  if (data.bankCard) {
    const qrDataUrl = await generateQRCode(data.bankCard)
    if (qrDataUrl) {
      qrCodeHtml = `
      <div class="divider"></div>
      <div class="qr-section">
        <div class="qr-title">Karta orqali to'lov</div>
        <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
        <div class="qr-hint">QR kodni skanerlang</div>
      </div>`
    }
  }

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
  
  /* QR Code styles */
  .qr-section {
    text-align: center;
    padding: 2mm 0;
  }
  .qr-title {
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 2mm;
  }
  .qr-code {
    width: 35mm;
    height: 35mm;
    margin: 1mm auto;
  }
  .qr-hint {
    font-size: 11px;
    color: #555;
    margin-top: 1mm;
  }
  
  .footer { 
    text-align: center; 
    font-size: 12px; 
    margin-top: 3mm; 
  }
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
  ${qrCodeHtml}
  <div class="footer">${receiptFooter}<br>${shopName}</div>
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

  const itemsHtml = data.items.map(i => {
    const lineTotal = i.salePrice * i.qty
    return `
    <div class="item">
      <div class="item-name">${i.productName}</div>
      <div class="item-detail">
        <span>${i.qty} ${i.unit} × ${i.salePrice.toLocaleString('uz-UZ')}</span>
        <span class="bold">${lineTotal.toLocaleString('uz-UZ')}</span>
      </div>
    </div>`
  }).join('')

  const returnedGroups = new Map<string, ReturnedPrintItem[]>()
  for (const item of (data.returnedItems ?? [])) {
    const key = item.receiptNo ? `Chek #${item.receiptNo}` : 'Qaytarilgan'
    if (!returnedGroups.has(key)) returnedGroups.set(key, [])
    returnedGroups.get(key)!.push(item)
  }
  let returnedHtml = ''
  for (const [groupTitle, groupItems] of returnedGroups) {
    returnedHtml += `<div class="return-group-title">${groupTitle}</div>`
    returnedHtml += groupItems.map(i => {
      const lineTotal = Math.abs(i.salePrice) * Math.abs(i.qty)
      const unit = i.unit || 'dona'
      return `<div class="item returned-item">
      <div class="item-name">↩ ${i.productName}</div>
      <div class="item-detail">
        <span>${i.qty} ${unit} × ${i.salePrice.toLocaleString('uz-UZ')}</span>
        <span class="bold">-${lineTotal.toLocaleString('uz-UZ')}</span>
      </div>
    </div>`
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
  .item { border-bottom: 1px dotted #ccc; padding: 1.5mm 0; }
  .item-name { font-weight: bold; font-size: 15px; word-break: break-word; }
  .returned-item { background: #fff3f3; }
  .returned-item .item-name { color: #cc0000; }
  .returned-item .item-detail { color: #cc0000; }
  .item-detail { display: flex; justify-content: space-between; font-size: 14px; margin-top: 0.5mm; }
  .info { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; }
  .info-red { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; color: #cc0000; }
  .info-green { display: flex; justify-content: space-between; margin: 1.5mm 0; font-size: 15px; color: #007700; }
  .debt-total { text-align: center; font-size: 18px; font-weight: bold; margin: 2mm 0; padding: 2mm; background: #f5f5f5; }
  .customer-name { text-align: center; font-size: 16px; font-weight: bold; margin: 2mm 0; }
  .section-title { text-align:center; font-size:14px; font-weight:bold; color:#cc0000; margin:3mm 0; padding:2mm 0; border-top:2px solid #cc0000; border-bottom:2px solid #cc0000; }
  .return-group-title { font-size:13px; color:#cc0000; font-weight:bold; padding:1mm 0; margin-top:1.5mm; border-bottom:1px dashed #cc0000; }
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
  ${itemsHtml}
  ${returnedTotal > 0 ? `
  <div class="divider"></div>
  <div class="section-title">⚠ QAYTARILGAN TOVARLAR ⚠</div>
  ${returnedHtml}
  ` : ''}
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
  setTimeout(() => {
    win.print()
    win.close()
  }, 300)
}
