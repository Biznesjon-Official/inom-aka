import { Schema, model, models, Types } from 'mongoose'

const SavedCartItemSchema = new Schema({
  product: { type: Types.ObjectId, ref: 'Product', required: true },
  qty: { type: Number, required: true },
}, { _id: false })

const SavedCartSchema = new Schema({
  name: { type: String, required: true },
  items: [SavedCartItemSchema],
  createdBy: { type: Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default models.SavedCart || model('SavedCart', SavedCartSchema)
