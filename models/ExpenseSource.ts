import { Schema, model, models } from 'mongoose'

const ExpenseSourceSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
}, { timestamps: true })

export default models.ExpenseSource || model('ExpenseSource', ExpenseSourceSchema)
