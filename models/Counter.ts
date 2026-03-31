import { Schema, model, models } from 'mongoose'

const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 10000 },
})

export default models.Counter || model('Counter', CounterSchema)
