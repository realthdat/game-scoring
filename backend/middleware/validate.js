import mongoose from 'mongoose';

/**
 * Middleware: kiểm tra param id là MongoDB ObjectId hợp lệ.
 * Gọi với validateObjectId('paramName') — mặc định 'id'.
 */
export function validateObjectId(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({ error: 'Id không hợp lệ' });
    }
    next();
  };
}

/**
 * Kiểm tra roomId (dùng trong routes rounds)
 */
export function validateRoomId(req, res, next) {
  const value = req.params.roomId;
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return res.status(400).json({ error: 'Room id không hợp lệ' });
  }
  next();
}
