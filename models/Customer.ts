import { Schema, model, models } from 'mongoose'
import Counter from './Counter'

const CustomerSchema = new Schema({
  seqNo: { type: Number, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  note: { type: String },
  totalDebt: { type: Number, default: 0 },
  cashbackPercent: { type: Number, default: 0, min: 0, max: 100 },
  cashbackEndDate: { type: Date },
  totalSalesOverride: { type: Number, default: null },
}, { timestamps: true })

CustomerSchema.index({ name: 1 })
CustomerSchema.index({ phone: 1 })

CustomerSchema.pre('save', async function () {
  if (!this.seqNo) {
    const counter = await Counter.findByIdAndUpdate(
      'customerSeqNo',
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    )
    this.seqNo = counter.seq
  }
})

export default models.Customer || model('Customer', CustomerSchema)
