import mongoose from 'mongoose';

const guestSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, trim: true },
}, { _id: false });

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  host_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  host_guest_id: { type: String },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  guests: [guestSchema],
  created_at: { type: Date, default: Date.now },
  ended_at: { type: Date },
});

roomSchema.index({ status: 1, created_at: -1 });

export const Room = mongoose.model('Room', roomSchema);
