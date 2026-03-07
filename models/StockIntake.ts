import { Schema, model, models, Types } from 'mongoose'

const StockIntakeSchema = new Schema({
  items: [{
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
  }],
  supplier: { type: String },
  note: { type: String },
  totalCost: { type: Number, required: true },
  createdBy: { type: Types.ObjectId, ref: 'User' },
}, { timestamps: true })

StockIntakeSchema.index({ createdAt: -1 })

export default models.StockIntake || model('StockIntake', StockIntakeSchema)
