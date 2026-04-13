import { Schema, model, models, Types } from 'mongoose'
import './DebtCategory'

const DebtPaymentSchema = new Schema({
  amount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'card', 'terminal'], default: 'cash' },
  date: { type: Date, default: Date.now },
  note: { type: String },
  fromSale: { type: Boolean, default: false }, // initial payment from kassa — already counted in Sale.paid
  refunded: { type: Boolean, default: false }, // marked true when sale is returned
  saleRef: { type: Types.ObjectId, ref: 'Sale' }, // which sale this payment belongs to
  salePayedBefore: { type: Number, default: 0 }, // sale.paid value BEFORE this payment (for accurate profit calc)
}, { _id: false })

const DebtEntrySchema = new Schema({
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 }, // how much was paid upfront for this entry
  note: { type: String },
  date: { type: Date, default: Date.now },
  sale: { type: Types.ObjectId, ref: 'Sale' }, // which sale created this entry
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
  entries: [DebtEntrySchema],
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
