// Chỉ cho phép 1 socket đang "host" mỗi room. roomId -> { socketId, userId }
const hostByRoom = new Map();
// socketId -> { roomId, userId } để khi disconnect có thể clear
const socketToHost = new Map();

export function tryClaimHost(roomId, userId, socketId) {
  const existing = hostByRoom.get(roomId);
  if (existing && existing.socketId !== socketId) {
    return { ok: false, message: 'Host đang nhập từ thiết bị khác. Không mở 2 browser.' };
  }
  hostByRoom.set(roomId, { socketId, userId });
  socketToHost.set(socketId, { roomId, userId });
  return { ok: true };
}

export function releaseHost(socketId) {
  const info = socketToHost.get(socketId);
  if (info) {
    if (hostByRoom.get(info.roomId)?.socketId === socketId) {
      hostByRoom.delete(info.roomId);
    }
    socketToHost.delete(socketId);
  }
}

export function isCurrentHost(roomId, socketId) {
  const cur = hostByRoom.get(roomId);
  return cur && cur.socketId === socketId;
}
