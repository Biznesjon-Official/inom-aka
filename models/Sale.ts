import { Schema, model, models, Types } from 'mongoose'
import Counter from './Counter'

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
  costPrice: { type: Number, default: 0 },
  returnedAt: { type: Date, default: Date.now },
}, { _id: false })

const SalePaymentSchema = new Schema({
  method: { type: String, enum: ['cash', 'card', 'terminal'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
}, { _id: false })

const SaleSchema = new Schema({
  receiptNo: { type: Number, unique: true },
  items: [SaleItemSchema],
  total: { type: Number, required: true },
  paid: { type: Number, required: true },
  cashier: { type: Types.ObjectId, ref: 'User', required: true },
  customer: { type: Types.ObjectId, ref: 'Customer' },
  usta: { type: Types.ObjectId, ref: 'User' },
  debt: { type: Types.ObjectId, ref: 'Debt' },
  paymentType: { type: String, enum: ['full', 'partial', 'debt'], required: true },
  payments: [SalePaymentSchema],
  note: { type: String },
  returnedItems: [ReturnItemSchema],
  returnedTotal: { type: Number, default: 0 },
  returnedCostTotal: { type: Number, default: 0 },
}, { timestamps: true })

SaleSchema.index({ cashier: 1, createdAt: -1 })
SaleSchema.index({ customer: 1, createdAt: -1 })

// Atomic auto-increment receiptNo
SaleSchema.pre('save', async function () {
  if (!this.receiptNo) {
    const counter = await Counter.findByIdAndUpdate(
      'receiptNo',
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    )
    this.receiptNo = counter.seq
  }
})

export default models.Sale || model('Sale', SaleSchema)
