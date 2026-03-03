import { Schema, model, models, Types } from 'mongoose'

const SaleItemSchema = new Schema({
  product: { type: Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true }, // snapshot
  unit: { type: String, required: true },
  qty: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
}, { _id: false })

const SaleSchema = new Schema({
  items: [SaleItemSchema],
  total: { type: Number, required: true },
  paid: { type: Number, required: true },
  cashier: { type: Types.ObjectId, ref: 'User', required: true },
  customer: { type: Types.ObjectId, ref: 'Customer' },
  paymentType: { type: String, enum: ['full', 'partial', 'debt'], required: true },
  note: { type: String },
}, { timestamps: true })

SaleSchema.index({ cashier: 1, createdAt: -1 })
SaleSchema.index({ customer: 1, createdAt: -1 })

export default models.Sale || model('Sale', SaleSchema)
