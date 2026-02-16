import mongoose from 'mongoose';

const scoreEntrySchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guest_id: { type: String },
  round_score: { type: Number, required: true, default: 0 },
  cumulative_score: { type: Number, required: true, default: 0 },
}, { _id: false });

const roundSchema = new mongoose.Schema({
  room_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  round_number: { type: Number, required: true },
  scores: [scoreEntrySchema],
  host_score: { type: Number, required: true },
  host_cumulative: { type: Number, default: 0 },
  host_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  host_guest_id: { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  created_at: { type: Date, default: Date.now },
});

roundSchema.index({ room_id: 1, round_number: 1 }, { unique: true });

export const Round = mongoose.model('Round', roundSchema);
