import { Schema, model, models, Types } from 'mongoose'

const CashbackPayoutSchema = new Schema({
  customer: { type: Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  totalSales: { type: Number, required: true },
  percent: { type: Number, required: true },
  type: { type: String, enum: ['money', 'gift'], default: 'money' },
  note: { type: String },
}, { timestamps: true })

CashbackPayoutSchema.index({ customer: 1, periodFrom: 1, periodTo: 1 })

export default models.CashbackPayout || model('CashbackPayout', CashbackPayoutSchema)
