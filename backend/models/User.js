import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});
// unique: true đã tạo index, không khai báo index trùng

export const User = mongoose.model('User', userSchema);

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
