import { Router } from 'express';
import crypto from 'crypto';
import { Room } from '../models/Room.js';
import { Round } from '../models/Round.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcastToRoom } from '../lib/socketEmitter.js';
import { validateObjectId } from '../middleware/validate.js';

const router = Router();

// Xem phòng công khai (không cần đăng nhập)
router.get('/:id/public', validateObjectId('id'), async (req, res) => {
  try {
    let room = await Room.findById(req.params.id)
      .select('name status owner_id host_id host_guest_id players guests created_at ended_at')
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (!room.owner_id) room = { ...room, owner_id: room.host_id };
    res.json(room);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(authMiddleware);

// Danh sách phòng (của tôi: active + đã kết thúc, để xem lại)
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find({
      $or: [{ owner_id: req.user._id }, { owner_id: { $exists: false }, host_id: req.user._id }],
    })
      .sort({ status: 1, created_at: -1 }) // active trước, rồi ended; mới nhất trước
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const ROOM_NAME_MAX = 80;

// Tạo phòng — chỉ cần đăng ký 1 lần, người tạo là owner và Cái ban đầu
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const roomName = (name?.trim() || 'Phòng mới').slice(0, ROOM_NAME_MAX);
    const room = await Room.create({
      name: roomName,
      owner_id: req.user._id,
      host_id: req.user._id,
      players: [req.user._id],
    });
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Chi tiết phòng
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    let room = await Room.findById(req.params.id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (!room.owner_id) room = { ...room, owner_id: room.host_id };
    res.json(room);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Tham gia phòng (tùy chọn — chủ yếu dùng guest)
router.post('/:id/join', validateObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Phòng đã kết thúc' });
    const uid = req.user._id;
    if (room.players.some((p) => p.toString() === uid.toString())) {
      return res.json(await Room.findById(room._id).populate(['owner_id', 'host_id', 'players']).lean());
    }
    room.players.push(uid);
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'room_updated', populated);
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Chuyển Cái (chỉ owner) — chọn user hoặc guest qua UI, không cần đăng nhập account khác
router.post('/:id/swap-host', validateObjectId('id'), async (req, res) => {
  try {
    const { newHostUserId, newHostGuestId } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Phòng đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được chuyển Cái' });
    }
    if (newHostUserId != null) {
      const inPlayers = room.players.some((p) => p.toString() === newHostUserId);
      if (!inPlayers) return res.status(400).json({ error: 'Người chơi không ở trong phòng' });
      room.host_id = newHostUserId;
      room.host_guest_id = undefined;
    } else if (newHostGuestId != null) {
      const guest = (room.guests || []).find((g) => g.id === newHostGuestId);
      if (!guest) return res.status(400).json({ error: 'Không tìm thấy người chơi' });
      room.host_id = undefined;
      room.host_guest_id = newHostGuestId;
    } else {
      return res.status(400).json({ error: 'Chọn người làm Cái (user hoặc guest)' });
    }
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'room_updated', populated);
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manual stop (kết thúc game) — chỉ owner
router.post('/:id/end', validateObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status === 'ended') return res.status(400).json({ error: 'Phòng đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được kết thúc game' });
    }
    room.status = 'ended';
    room.ended_at = new Date();
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'room_ended', populated);
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rời phòng — chỉ khi game đã kết thúc (§7: không cho Player rời khi active)
router.post('/:id/leave', validateObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status === 'active') {
      return res.status(400).json({ error: 'Không được rời phòng khi game đang diễn ra' });
    }
    const uid = req.user._id;
    const idx = room.players.findIndex((p) => p.toString() === uid.toString());
    if (idx === -1) return res.json(await Room.findById(room._id).populate('host_id', 'username').populate('players', 'username').lean());
    room.players.splice(idx, 1);
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Thêm người chơi (guest) — chỉ owner — chỉ Host, không cần đăng ký
router.post('/:id/guests', validateObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Phòng đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được thêm người chơi' });
    }
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nhập tên người chơi' });
    const id = crypto.randomUUID();
    room.guests = room.guests || [];
    room.guests.push({ id, name });
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'room_updated', populated);
    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Xóa người chơi (guest) — chỉ owner — không cho xóa nếu đã có round/điểm (bảo toàn dữ liệu)
router.delete('/:id/guests/:guestId', validateObjectId('id'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Phòng đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được xóa người chơi' });
    }
    const guestId = req.params.guestId;
    const hasRecords = await Round.exists({
      room_id: room._id,
      $or: [
        { 'scores.guest_id': guestId },
        { host_guest_id: guestId },
      ],
    });
    if (hasRecords) {
      return res.status(400).json({
        error: 'Không thể xóa người chơi đã có điểm trong phòng. Để bảo đảm dữ liệu không bị sai lệch.',
      });
    }
    room.guests = room.guests || [];
    const before = room.guests.length;
    room.guests = room.guests.filter((g) => g.id !== guestId);
    if (room.guests.length === before) return res.status(404).json({ error: 'Không tìm thấy người chơi' });
    await room.save();
    const populated = await Room.findById(room._id)
      .populate('owner_id', 'username')
      .populate('host_id', 'username')
      .populate('players', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'room_updated', populated);
    res.json(populated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
