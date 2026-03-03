import { Schema, model, models } from 'mongoose'

const CustomerSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  note: { type: String },
  totalDebt: { type: Number, default: 0 },
  cashbackPercent: { type: Number, default: 0, min: 0, max: 100 },
}, { timestamps: true })

CustomerSchema.index({ name: 1 })

export default models.Customer || model('Customer', CustomerSchema)
