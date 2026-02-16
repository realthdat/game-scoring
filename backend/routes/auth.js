import { Router } from 'express';
import { User, hashPassword, comparePassword } from '../models/User.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Cần username và password' });
    }
    const u = username.trim();
    const existing = await User.findOne({ username: u });
    if (existing) return res.status(400).json({ error: 'Username đã tồn tại' });
    const password_hash = await hashPassword(password);
    const user = await User.create({ username: u, password_hash });
    const token = signToken(user._id);
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Cần username và password' });
    }
    const user = await User.findOne({ username: username.trim() });
    if (!user) return res.status(401).json({ error: 'Sai username hoặc password' });
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Sai username hoặc password' });
    const token = signToken(user._id);
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
