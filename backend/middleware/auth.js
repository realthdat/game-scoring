import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    User.findById(decoded.userId)
      .then((user) => {
        if (!user) return res.status(401).json({ error: 'User không tồn tại' });
        req.user = user;
        next();
      })
      .catch(() => res.status(401).json({ error: 'Token không hợp lệ' }));
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
