import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Dùng Google DNS để tránh lỗi querySrv ECONNREFUSED trên một số mạng/Windows
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import roundRoutes from './routes/rounds.js';
import { User } from './models/User.js';
import { tryClaimHost, releaseHost } from './lib/hostSessions.js';
import { setIO } from './lib/socketEmitter.js';

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rounds', roundRoutes);

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true },
});

function getUserIdFromSocket(socket) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId;
  } catch {
    return null;
  }
}

io.use(async (socket, next) => {
  const userId = getUserIdFromSocket(socket);
  if (!userId) return next(new Error('Chưa đăng nhập'));
  const user = await User.findById(userId).select('username').lean();
  if (!user) return next(new Error('User không tồn tại'));
  socket.userId = userId;
  socket.username = user.username;
  next();
});

io.on('connection', (socket) => {
  socket.on('join_room', (roomId, cb) => {
    const rid = String(roomId);
    socket.join(rid);
    socket.currentRoomId = rid;
    cb?.({ ok: true });
  });

  socket.on('claim_host', (roomId, cb) => {
    const rid = String(roomId);
    const result = tryClaimHost(rid, socket.userId, socket.id);
    if (result.ok) {
      socket.currentRoomId = rid;
      socket.isHost = true;
    }
    cb?.(result);
  });

  socket.on('disconnect', () => {
    releaseHost(socket.id);
  });
});

// Gắn io vào app để routes có thể emit
setIO(io);

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/game_scoring';

mongoose.connect(mongoUri).then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Lỗi kết nối MongoDB:', err.message);
  if (err.code === 'ECONNREFUSED' && err.syscall === 'querySrv') {
    console.error('');
    console.error('Gợi ý: Mạng/DNS có thể chặn mongodb+srv. Thử dùng Standard connection string:');
    console.error('  1. Vào MongoDB Atlas → Database → Connect → Drivers → Node.js');
    console.error('  2. Chọn "Standard connection string" (không dùng SRV)');
    console.error('  3. Copy vào .env: MONGODB_URI=<chuỗi đó>, thay <password> bằng mật khẩu thật');
    console.error('  Hoặc chạy MongoDB local và đặt: MONGODB_URI=mongodb://127.0.0.1:27017/game_scoring');
  }
});

