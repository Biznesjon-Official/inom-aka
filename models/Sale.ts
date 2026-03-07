import { Schema, model, models, Types, Model } from 'mongoose'

const SaleItemSchema = new Schema({
  product: { type: Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true }, // snapshot
  unit: { type: String, required: true },
  qty: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
}, { _id: false })

const ReturnItemSchema = new Schema({
  product: { type: Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  qty: { type: Number, required: true },
  salePrice: { type: Number, required: true },
  returnedAt: { type: Date, default: Date.now },
}, { _id: false })

const SaleSchema = new Schema({
  receiptNo: { type: Number, unique: true },
  items: [SaleItemSchema],
  total: { type: Number, required: true },
  paid: { type: Number, required: true },
  cashier: { type: Types.ObjectId, ref: 'User', required: true },
  customer: { type: Types.ObjectId, ref: 'Customer' },
  paymentType: { type: String, enum: ['full', 'partial', 'debt'], required: true },
  note: { type: String },
  returnedItems: [ReturnItemSchema],
  returnedTotal: { type: Number, default: 0 },
}, { timestamps: true })

SaleSchema.index({ cashier: 1, createdAt: -1 })
SaleSchema.index({ customer: 1, createdAt: -1 })

// Auto-increment receiptNo before save
SaleSchema.pre('save', async function () {
  if (!this.receiptNo) {
    const SaleModel = this.constructor as Model<unknown>
    const last = await SaleModel.findOne({}, { receiptNo: 1 }).sort({ receiptNo: -1 }).lean() as { receiptNo?: number } | null
    this.receiptNo = (last?.receiptNo || 10000) + 1
  }
})

export default models.Sale || model('Sale', SaleSchema)
