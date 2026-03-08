import { Schema, model, models } from 'mongoose'

const UserSchema = new Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'worker'], default: 'worker' },
  salary: {
    fixed: { type: Number, default: 0 },
    salesPercent: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

export default models.User || model('User', UserSchema)
