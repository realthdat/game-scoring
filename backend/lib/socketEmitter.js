let io = null;

export function setIO(serverIo) {
  io = serverIo;
}

export function getIO() {
  return io;
}

export function broadcastToRoom(roomId, event, payload) {
  if (io) io.to(String(roomId)).emit(event, payload);
}
