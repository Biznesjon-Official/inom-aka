import { Schema, model, models } from 'mongoose'

const CustomerSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  note: { type: String },
  totalDebt: { type: Number, default: 0 },
}, { timestamps: true })

export default models.Customer || model('Customer', CustomerSchema)
