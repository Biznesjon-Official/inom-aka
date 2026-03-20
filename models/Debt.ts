import { Schema, model, models, Types } from 'mongoose'
import './DebtCategory'

const DebtPaymentSchema = new Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'card', 'terminal'], default: 'cash' },
  date: { type: Date, default: Date.now },
  note: { type: String },
  fromSale: { type: Boolean, default: false }, // initial payment from kassa — already counted in Sale.paid
}, { _id: false })

const DebtSchema = new Schema({
  customer: { type: Types.ObjectId, ref: 'Customer' },
  customerName: { type: String },
  customerPhone: { type: String },
  sale: { type: Types.ObjectId, ref: 'Sale' },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  payments: [DebtPaymentSchema],
  status: { type: String, enum: ['active', 'paid'], default: 'active' },
  type: { type: String, enum: ['customer', 'personal'], default: 'customer' },
  direction: { type: String, enum: ['receivable', 'payable'], default: 'receivable' },
  description: { type: String },
  note: { type: String },
  category: { type: Types.ObjectId, ref: 'DebtCategory' },
}, { timestamps: true })

DebtSchema.index({ customer: 1, status: 1 })
DebtSchema.index({ status: 1, createdAt: -1 })

export default models.Debt || model('Debt', DebtSchema)
