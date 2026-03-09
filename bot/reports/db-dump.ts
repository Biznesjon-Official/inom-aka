/* eslint-disable @typescript-eslint/no-explicit-any */
import Product from '../../models/Product'
import '../../models/Category'
import { sendDocumentToAll, sendPhotoToAll, sendDocumentTo, sendPhotoTo } from '../utils/send'
import { formatDate } from '../utils/format'

export async function sendDbDump(bot: any, chatId?: string | number): Promise<void> {
  const products = await Product.find({ isActive: true })
    .populate('category', 'name')
    .lean()

  // JSON dump without images
  const jsonData = products.map((p: any) => ({
    name: p.name,
    category: p.category?.name || null,
    unit: p.unit,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    wholesalePrice: p.wholesalePrice || null,
    stock: p.stock,
  }))

  const dateStr = formatDate(new Date())
  const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8')
  const caption = `Mahsulotlar (${products.length} ta)`
  const filename = `products_${dateStr}.json`

  if (chatId) {
    await sendDocumentTo(bot, chatId, jsonBuffer, filename, caption)
  } else {
    await sendDocumentToAll(bot, jsonBuffer, filename, caption)
  }

  // Send product images
  const productsWithImages = products.filter((p: any) => p.image && p.image.startsWith('data:'))
  for (const product of productsWithImages as any[]) {
    try {
      const matches = product.image.match(/^data:image\/(\w+);base64,(.+)$/)
      if (!matches) continue

      const imageBuffer = Buffer.from(matches[2], 'base64')
      const imgFilename = `${product.name}.${matches[1]}`

      if (chatId) {
        await sendPhotoTo(bot, chatId, imageBuffer, imgFilename, product.name)
      } else {
        await sendPhotoToAll(bot, imageBuffer, imgFilename, product.name)
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      console.error(`Failed to send image for ${product.name}:`, err)
    }
  }
}
