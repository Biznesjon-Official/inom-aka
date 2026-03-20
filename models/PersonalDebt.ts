import { Schema, model, models, Types } from 'mongoose'
import './DebtCategory'

const PaymentSchema = new Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  note: { type: String },
}, { _id: false })

const PersonalDebtSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String },
  direction: { type: String, enum: ['receivable', 'payable'], required: true },
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingAmount: { type: Number, required: true },
  payments: [PaymentSchema],
  status: { type: String, enum: ['active', 'paid'], default: 'active' },
  note: { type: String },
  category: { type: Types.ObjectId, ref: 'DebtCategory' },
}, { timestamps: true })

PersonalDebtSchema.index({ status: 1, createdAt: -1 })

export default models.PersonalDebt || model('PersonalDebt', PersonalDebtSchema)
