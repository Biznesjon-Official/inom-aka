import { Schema, model, models } from 'mongoose'

const SettingsSchema = new Schema({
  key: { type: String, unique: true, required: true },
  value: { type: Schema.Types.Mixed, required: true },
})

export default models.Settings || model('Settings', SettingsSchema)
