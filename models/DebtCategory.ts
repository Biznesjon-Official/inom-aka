import { Schema, model, models } from 'mongoose'

const DebtCategorySchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
}, { timestamps: true })

export default models.DebtCategory || model('DebtCategory', DebtCategorySchema)
