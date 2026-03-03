import { Schema, model, models, Types } from 'mongoose'

const ProductSchema = new Schema({
  name: { type: String, required: true },
  category: { type: Types.ObjectId, ref: 'Category' },
  unit: { type: String, enum: ['dona', 'kg', 'm', 'l'], default: 'dona' },
  costPrice: { type: Number, required: true },
  salePrice: { type: Number, required: true },
  discountPrice: { type: Number },
  discountThreshold: { type: Number }, // minimum qty for discount
  description: { type: String },
  image: { type: String }, // URL or base64
  stock: { type: Number, default: 0 }, // current inventory
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

ProductSchema.index({ category: 1, isActive: 1 })
ProductSchema.index({ isActive: 1, createdAt: -1 })

export default models.Product || model('Product', ProductSchema)
