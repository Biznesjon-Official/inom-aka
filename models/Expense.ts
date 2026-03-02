import { Schema, model, models, Types } from 'mongoose'

const ExpenseSchema = new Schema({
  source: { type: Types.ObjectId, ref: 'ExpenseSource', required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
}, { timestamps: true })

export default models.Expense || model('Expense', ExpenseSchema)
