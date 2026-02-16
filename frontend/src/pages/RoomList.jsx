import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rooms } from '../api';

export default function RoomList() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [roomList, setRoomList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    rooms(token).list()
      .then(setRoomList)
      .catch(() => setRoomList([]))
      .finally(() => setLoading(false));
  }, [token]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const room = await rooms(token).create(createName || 'Phòng mới');
      navigate(`/room/${room._id}`);
    } catch (err) {
      setError(err.message || 'Tạo phòng thất bại');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ maxWidth: 640 }}>
      <header className="page-header" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title">Phòng chơi</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="text-muted">{user?.username}</span>
          <button type="button" className="btn-secondary" onClick={logout} style={{ width: 'auto', minHeight: 36, padding: '6px 14px', fontSize: '0.85rem' }}>
            Thoát
          </button>
        </div>
      </header>

      <div className="section-card">
        <h2 className="section-title">Tạo phòng mới</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Tên phòng"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Đang tạo...' : 'Tạo phòng'}
          </button>
        </form>
      </div>

      <div className="section-card">
        <h2 className="section-title">Phòng của tôi</h2>
        {error && <p className="text-danger" style={{ marginBottom: 12 }}>{error}</p>}
        {loading ? (
          <p className="text-muted">Đang tải...</p>
        ) : roomList.length === 0 ? (
          <p className="text-muted">Chưa có phòng nào. Tạo phòng để bắt đầu (chỉ bạn cần đăng nhập).</p>
        ) : (
          <ul className="room-list">
            {roomList.map((room) => (
              <li key={room._id} className="room-item">
                <div className="room-info">
                  <strong>{room.name}</strong>
                  <span className="room-meta">
                    {room.status === 'ended' && <span className="status-badge ended" style={{ marginRight: 6 }}>Đã kết thúc</span>}
                    Cái: {room.host_id?.username || (room.guests || []).find((g) => g.id === room.host_guest_id)?.name || '—'} · {(room.players?.length || 0) + (room.guests?.length || 0)} người
                  </span>
                </div>
                <button type="button" className="btn-primary" onClick={() => navigate(`/room/${room._id}`)}>
                  {room.status === 'ended' ? 'Xem' : 'Vào phòng'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
