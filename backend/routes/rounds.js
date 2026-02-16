import { Router } from 'express';
import { Room } from '../models/Room.js';
import { Round } from '../models/Round.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcastToRoom } from '../lib/socketEmitter.js';
import { validateRoomId } from '../middleware/validate.js';

const router = Router();

// Xem rounds công khai (không cần đăng nhập)
router.get('/room/:roomId/public', validateRoomId, async (req, res) => {
  try {
    const rounds = await Round.find({ room_id: req.params.roomId })
      .sort({ round_number: 1 })
      .populate('scores.user_id', 'username')
      .populate('created_by', 'username')
      .lean();
    res.json(rounds);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.use(authMiddleware);

function toFiniteScore(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// Lấy tất cả rounds của phòng
router.get('/room/:roomId', validateRoomId, async (req, res) => {
  try {
    const rounds = await Round.find({ room_id: req.params.roomId })
      .sort({ round_number: 1 })
      .populate('scores.user_id', 'username')
      .populate('created_by', 'username')
      .lean();
    res.json(rounds);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit round mới — chỉ owner (chủ phòng) nhập điểm; Cái có thể là user hoặc guest (chọn trên UI)
router.post('/room/:roomId', validateRoomId, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Game đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được nhập điểm' });
    }

    const lastRound = await Round.findOne({ room_id: room._id }).sort({ round_number: -1 });
    const nextRoundNumber = lastRound ? lastRound.round_number + 1 : 1;

    const currentHostKey = room.host_id != null ? String(room.host_id) : (room.host_guest_id != null ? `g:${room.host_guest_id}` : null);
    const conUserIds = room.players.filter((p) => currentHostKey !== String(p));
    const conGuests = (room.guests || []).filter((g) => currentHostKey !== `g:${g.id}`);

    const rawScores = req.body.scores || [];
    const scoreMap = new Map();
    rawScores.forEach((s) => {
      const key = s.user_id != null ? String(s.user_id) : (s.guest_id != null ? `g:${s.guest_id}` : null);
      if (key) scoreMap.set(key, toFiniteScore(s.round_score));
    });

    const scores = [];
    conUserIds.forEach((uid) => {
      scores.push({ user_id: uid, round_score: toFiniteScore(scoreMap.get(uid.toString())), cumulative_score: 0 });
    });
    conGuests.forEach((g) => {
      scores.push({ guest_id: g.id, round_score: toFiniteScore(scoreMap.get(`g:${g.id}`)), cumulative_score: 0 });
    });

    const totalCon = scores.reduce((sum, s) => sum + s.round_score, 0);
    const hostScore = -totalCon;

    const keyOf = (s) => (s.user_id != null ? String(s.user_id) : `g:${s.guest_id}`);
    let hostCumulative = 0;
    const prevCumulative = new Map();
    if (lastRound) {
      lastRound.scores.forEach((s) => prevCumulative.set(keyOf(s), s.cumulative_score));
      const lastHostKey = lastRound.host_user_id != null ? String(lastRound.host_user_id) : (lastRound.host_guest_id != null ? `g:${lastRound.host_guest_id}` : null);
      if (lastHostKey) prevCumulative.set(lastHostKey, lastRound.host_cumulative ?? 0);
    }
    scores.forEach((s) => {
      s.cumulative_score = (prevCumulative.get(keyOf(s)) ?? 0) + s.round_score;
    });
    if (currentHostKey) hostCumulative = (prevCumulative.get(currentHostKey) ?? 0) + hostScore;

    const round = await Round.create({
      room_id: room._id,
      round_number: nextRoundNumber,
      scores,
      host_score: hostScore,
      host_cumulative: hostCumulative,
      host_user_id: room.host_id || undefined,
      host_guest_id: room.host_guest_id || undefined,
      created_by: req.user._id,
    });

    const populated = await Round.findById(round._id)
      .populate('scores.user_id', 'username')
      .populate('created_by', 'username')
      .lean();
    broadcastToRoom(room._id.toString(), 'round_added', populated);
    res.status(201).json(populated);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Vòng này đã được ghi. Tránh double submit.' });
    res.status(500).json({ error: e.message });
  }
});

// Undo: xóa round vừa tạo (chỉ round cuối, chỉ owner)
router.delete('/room/:roomId/last', validateRoomId, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Không tìm thấy phòng' });
    if (room.status !== 'active') return res.status(400).json({ error: 'Game đã kết thúc' });
    const ownerId = room.owner_id || room.host_id;
    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Chỉ chủ phòng mới được undo' });
    }
    const lastRound = await Round.findOne({ room_id: room._id }).sort({ round_number: -1 });
    if (!lastRound) return res.status(400).json({ error: 'Không có round nào để undo' });
    await Round.findByIdAndDelete(lastRound._id);
    broadcastToRoom(room._id.toString(), 'round_undo', { round_number: lastRound.round_number });
    res.json({ deleted: lastRound._id, round_number: lastRound.round_number });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
