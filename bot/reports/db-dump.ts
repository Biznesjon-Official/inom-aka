/* eslint-disable @typescript-eslint/no-explicit-any */
import archiver from 'archiver'
import { PassThrough } from 'stream'
import Product from '../../models/Product'
import '../../models/Category'
import { sendDocumentToAll, sendDocumentTo } from '../utils/send'
import { formatDate } from '../utils/format'

async function createImagesZip(products: any[]): Promise<Buffer | null> {
  const withImages = products.filter((p: any) => p.image && p.image.startsWith('data:'))
  if (withImages.length === 0) return null

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    const stream = new PassThrough()

    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)

    archive.pipe(stream)

    for (const product of withImages) {
      const matches = product.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) continue
      const imageBuffer = Buffer.from(matches[2], 'base64')
      const ext = matches[1]
      const safeName = product.name.replace(/[/\\?%*:|"<>]/g, '_')
      archive.append(imageBuffer, { name: `${safeName}.${ext}` })
    }

    archive.finalize()
  })
}

export async function sendDbDump(bot: any, chatId?: string | number): Promise<void> {
  const products = await Product.find({ isActive: true })
    .populate('category', 'name')
    .lean()

  const dateStr = formatDate(new Date())

  // JSON dump
  const jsonData = products.map((p: any) => ({
    name: p.name,
    category: p.category?.name || null,
    unit: p.unit,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    wholesalePrice: p.wholesalePrice || null,
    stock: p.stock,
  }))

  const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8')
  const jsonCaption = `Mahsulotlar (${products.length} ta)`
  const jsonFilename = `products_${dateStr}.json`

  if (chatId) {
    await sendDocumentTo(bot, chatId, jsonBuffer, jsonFilename, jsonCaption)
  } else {
    await sendDocumentToAll(bot, jsonBuffer, jsonFilename, jsonCaption)
  }

  // Images ZIP
  const zipBuffer = await createImagesZip(products)
  if (zipBuffer) {
    const withImages = products.filter((p: any) => p.image && p.image.startsWith('data:'))
    const zipFilename = `images_${dateStr}.zip`
    const zipCaption = `Rasmlar (${withImages.length} ta)`

    if (chatId) {
      await sendDocumentTo(bot, chatId, zipBuffer, zipFilename, zipCaption)
    } else {
      await sendDocumentToAll(bot, zipBuffer, zipFilename, zipCaption)
    }
  }
}
