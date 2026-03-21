import { Schema, model, models } from 'mongoose'

const DebtCategorySchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  scope: { type: String, enum: ['customer', 'personal'], default: 'customer' },
}, { timestamps: true })

export default models.DebtCategory || model('DebtCategory', DebtCategorySchema)
