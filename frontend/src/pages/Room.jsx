import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { rooms, rounds } from '../api';

// Cái hiện tại: user (host_id) hoặc guest (host_guest_id)
function getCurrentHostKey(room) {
  if (!room) return null;
  if (room.host_id != null) return String(room.host_id?._id ?? room.host_id);
  if (room.host_guest_id != null) return `g:${room.host_guest_id}`;
  return null;
}

// Con = users (trừ Cái) + guests (trừ Cái)
function getConParticipants(room) {
  if (!room) return [];
  const hostKey = getCurrentHostKey(room);
  const list = [];
  (room.players || []).forEach((p) => {
    const key = String(p._id || p);
    if (key === hostKey) return;
    list.push({ key, name: p.username || '—', user_id: p._id || p, guest_id: null });
  });
  (room.guests || []).forEach((g) => {
    const key = `g:${g.id}`;
    if (key === hostKey) return;
    list.push({ key, name: g.name || '—', user_id: null, guest_id: g.id });
  });
  return list;
}

// Cột: Con + Cái (cuối). Cái có thể là user hoặc guest.
function getColumns(room) {
  const hostKey = getCurrentHostKey(room);
  const con = getConParticipants(room);
  let hostCol = null;
  if (room?.host_id != null) {
    const u = room.players?.find((p) => String(p._id || p) === String(room.host_id?._id ?? room.host_id));
    hostCol = { key: hostKey, name: u?.username || '—', isHost: true };
  } else if (room?.host_guest_id != null) {
    const g = (room.guests || []).find((x) => x.id === room.host_guest_id);
    hostCol = { key: hostKey, name: g?.name || '—', isHost: true };
  }
  return { con, hostCol, columns: [...con, hostCol].filter(Boolean) };
}

function ShareRoomModal({ roomId, onClose }) {
  const [toast, setToast] = useState(null);
  const roomUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : '';
  const qrSrc = roomUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomUrl)}` : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setToast('success');
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast('error');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div className="confirm-overlay share-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="share-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 id="share-modal-title" className="confirm-title">Chia sẻ link xem phòng</h3>
        {qrSrc && (
          <div className="share-qr-wrap">
            <img src={qrSrc} alt="QR code" width={200} height={200} />
          </div>
        )}
        <div className="share-url-wrap">
          <button type="button" className="btn-primary" onClick={handleCopy}>Sao chép link</button>
        </div>
        {toast && (
          <div className={`toast toast-${toast}`} role="status">
            {toast === 'success' ? 'Đã sao chép link.' : 'Không thể sao chép.'}
          </div>
        )}
        <div className="confirm-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [room, setRoom] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [toastError, setToastError] = useState(null);
  const [roundsList, setRoundsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hostClaimed, setHostClaimed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef(null);

  const showToastError = (msg) => {
    setToastError(msg || 'Có lỗi xảy ra');
    setTimeout(() => setToastError(null), 3500);
  };

  const isLoggedIn = !!token;
  const ownerId = room?.owner_id?._id ?? room?.owner_id ?? room?.host_id?._id ?? room?.host_id;
  const isOwner = room && user && ownerId && String(ownerId) === String(user?.id);

  useEffect(() => {
    const load = () => {
      if (isLoggedIn) {
        Promise.all([rooms(token).get(roomId), rounds(token).list(roomId)])
          .then(([r, list]) => { setRoom(r); setRoundsList(list); })
          .catch((err) => setError(err.message || 'Không tải được phòng'))
          .finally(() => setLoading(false));
      } else {
        const fetchPublic = () => {
          Promise.all([rooms(undefined).getPublic(roomId), rounds(undefined).listPublic(roomId)])
            .then(([r, list]) => { setRoom(r); setRoundsList(list); })
            .catch((err) => setError(err.message || 'Không tải được phòng'))
            .finally(() => setLoading(false));
        };
        fetchPublic();
        const t = setInterval(fetchPublic, 4000);
        return () => clearInterval(t);
      }
    };
    const cleanup = load();
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [roomId, isLoggedIn, token]);

  useEffect(() => {
    if (!token || !room) return;
    const socketUrl = import.meta.env.VITE_API_BASE || window.location.origin;
    const socket = io(socketUrl, { path: '/socket.io', auth: { token } });
    socketRef.current = socket;
    socket.emit('join_room', roomId);
    if (isOwner) setHostClaimed(true);
    const isDuplicateRound = (list, round) =>
      list.some((r) => r._id === round._id || (r.round_number === round.round_number && String(r.room_id?._id ?? r.room_id) === String(round.room_id?._id ?? round.room_id)));
    socket.on('round_added', (round) => { setRoundsList((prev) => (isDuplicateRound(prev, round) ? prev : [...prev, round])); });
    socket.on('round_undo', () => { setRoundsList((prev) => prev.slice(0, -1)); });
    socket.on('room_updated', (updated) => { setRoom(updated); });
    socket.on('room_ended', (ended) => { setRoom(ended); });
    return () => { socket.off('round_added').off('round_undo').off('room_updated').off('room_ended'); socket.disconnect(); socketRef.current = null; };
  }, [roomId, token, room?._id, isOwner]);

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }} className="text-muted">Đang tải phòng...</div>;
  if (error || !room) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <p className="text-danger" style={{ marginBottom: 16 }}>{error || 'Không tìm thấy phòng'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate(isLoggedIn ? '/' : '/login')} style={{ width: 'auto' }}>
          {isLoggedIn ? 'Về danh sách phòng' : 'Đăng nhập'}
        </button>
      </div>
    );
  }

  const roomEnded = room.status === 'ended';
  const canInput = isOwner && hostClaimed && !roomEnded;
  const { columns } = getColumns(room);
  const conParticipants = getConParticipants(room);

  return (
    <div className="page-wrapper">
      <header className="page-header">
        <button type="button" className="btn-secondary" onClick={() => navigate(isLoggedIn ? '/' : '/login')} style={{ width: 'auto', padding: '6px 12px', minHeight: 36, fontSize: '0.85rem' }}>
          {isLoggedIn ? '← Phòng' : '← Trang chủ'}
        </button>
        <h1 className="page-title">{room.name}</h1>
        <span className={`status-badge ${roomEnded ? 'ended' : 'active'}`}>
          {roomEnded ? 'Đã kết thúc' : 'Đang chơi'}
        </span>
        <button type="button" className="btn-icon-qr btn-secondary" onClick={() => setShowShareModal(true)} title="Chia sẻ QR / Link" aria-label="Chia sẻ QR / Link">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="4" height="4"/><rect x="9" y="14" width="4" height="4"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        {isLoggedIn && roomEnded && (
          <button type="button" className="btn-secondary" style={{ width: 'auto' }} onClick={async () => {
            try { await rooms(token).leave(roomId); navigate('/'); } catch (err) { setError(err.message || 'Không thể rời phòng'); }
          }}>Rời phòng</button>
        )}
      </header>

      {showShareModal && (
        <ShareRoomModal roomId={roomId} onClose={() => setShowShareModal(false)} />
      )}

      {error && <p className="text-danger" style={{ marginBottom: 12 }}>{error}</p>}

      <RoomTable room={room} roundsList={roundsList} columns={columns} />

      {canInput && (
        <RoundInput roomId={roomId} conParticipants={conParticipants} token={token}
          setRoundsList={setRoundsList} submitting={submitting} setSubmitting={setSubmitting} setError={setError} />
      )}

      {isOwner && !roomEnded && (
        <>
          <GuestManager roomId={roomId} room={room} token={token} setRoom={setRoom} roundsList={roundsList} showToastError={showToastError} />
          <HostActions roomId={roomId} room={room} token={token} roundsList={roundsList}
            setRoom={setRoom} setRoundsList={setRoundsList} showToastError={showToastError} />
        </>
      )}

      {toastError && (
        <div className="toast toast-error toast-global" role="alert">
          {toastError}
        </div>
      )}
    </div>
  );
}

function RoomTable({ room, roundsList, columns }) {
  const getScoreMapForRound = (r) => {
    const map = new Map();
    (r.scores || []).forEach((s) => {
      const key = s.user_id != null ? String(s.user_id?._id ?? s.user_id) : (s.guest_id != null ? `g:${s.guest_id}` : null);
      if (key) map.set(key, s.round_score);
    });
    const hostKey = r.host_user_id != null ? String(r.host_user_id?._id ?? r.host_user_id) : (r.host_guest_id != null ? `g:${r.host_guest_id}` : null) || (r.created_by != null ? String(r.created_by?._id ?? r.created_by) : null);
    if (hostKey) map.set(hostKey, r.host_score);
    return map;
  };
  const getCumulativeMap = () => {
    const cumMap = new Map();
    for (const r of roundsList) {
      const scoreMap = getScoreMapForRound(r);
      for (const [k, score] of scoreMap) cumMap.set(k, (cumMap.get(k) ?? 0) + score);
    }
    return cumMap;
  };
  const cumulativeByUser = getCumulativeMap();

  return (
    <div className="section-card">
      <h2 className="section-title">Bảng điểm</h2>
      <div className="table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th>Vòng</th>
              {columns.map((col, idx) => (
                <th key={col.key} className={col.isHost ? 'host-column' : ''}>
                  {col.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roundsList.map((r) => {
              const scoreByUser = getScoreMapForRound(r);
              return (
                <tr key={r._id}>
                  <td>{r.round_number}</td>
                  {columns.map((col) => (
                    <td key={col.key} className={col.isHost ? 'host-column' : ''}>
                      {scoreByUser.has(col.key) ? scoreByUser.get(col.key) : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="cumulative-row">
              <td>Tích lũy</td>
              {columns.map((col) => {
                const cum = cumulativeByUser.get(col.key);
                const isPositive = cum != null && Number(cum) > 0;
                const cellClass = [col.isHost ? 'host-column' : '', isPositive ? 'cumulative-positive' : ''].filter(Boolean).join(' ');
                return (
                  <td key={col.key} className={cellClass || undefined}>
                    {cumulativeByUser.has(col.key) ? cumulativeByUser.get(col.key) : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoundInput({ roomId, conParticipants, token, setRoundsList, submitting, setSubmitting, setError }) {
  const [inputs, setInputs] = useState({});
  const submitRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const scores = conParticipants.map((p) => {
        const raw = inputs[p.key];
        const n = Number(raw);
        return {
          user_id: p.user_id || undefined,
          guest_id: p.guest_id || undefined,
          round_score: Number.isFinite(n) ? n : 0,
        };
      });
      const newRound = await rounds(token).submit(roomId, scores);
      setRoundsList((prev) => {
        const has = prev.some((r) => r._id === newRound._id || (r.round_number === newRound.round_number && String(r.room_id?._id ?? r.room_id) === String(newRound.room_id?._id ?? newRound.room_id)));
        if (has) return prev;
        return [...prev, newRound];
      });
      setInputs({});
    } catch (err) {
      setError(err.message || 'Ghi điểm thất bại');
    } finally {
      setSubmitting(false);
      submitRef.current = false;
    }
  };

  return (
    <div className="section-card">
      <h2 className="section-title">Nhập điểm vòng mới</h2>
      <form onSubmit={handleSubmit} className="score-input-grid">
        {conParticipants.map((p) => (
          <div key={p.key} className="score-field">
            <label>{p.name}</label>
            <input
              type="number"
              step="any"
              inputMode="numeric"
              value={inputs[p.key] ?? ''}
              onChange={(e) => setInputs((prev) => ({ ...prev, [p.key]: e.target.value }))}
              placeholder="0"
            />
          </div>
        ))}
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Đang ghi...' : 'Ghi điểm vòng'}
        </button>
      </form>
    </div>
  );
}

// Guest đã có trong bất kỳ round nào (điểm hoặc Cái) thì không cho xóa
function guestHasRecords(guestId, roundsList) {
  if (!roundsList?.length) return false;
  return roundsList.some((r) => {
    if (r.host_guest_id === guestId) return true;
    return (r.scores || []).some((s) => s.guest_id === guestId);
  });
}

function GuestManager({ roomId, room, token, setRoom, roundsList, showToastError }) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const guests = room?.guests || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    const n = (name || '').trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      const updated = await rooms(token).addGuest(roomId, n);
      setRoom(updated);
      setName('');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (guestId) => {
    if (guestHasRecords(guestId, roundsList)) {
      showToastError?.('Người chơi đã có điểm không cho phép xóa (bảo toàn dữ liệu).');
      return;
    }
    try {
      const updated = await rooms(token).removeGuest(roomId, guestId);
      setRoom(updated);
    } catch (err) {
      showToastError?.(err.message);
    }
  };

  return (
    <div className="section-card">
      <h2 className="section-title">Thêm người chơi</h2>
      <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Tên người chơi"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={adding || !name.trim()}>
          {adding ? 'Đang thêm...' : 'Thêm người chơi'}
        </button>
      </form>
      {guests.length > 0 && (
        <ul style={{ marginTop: 12, listStyle: 'none' }}>
          {guests.map((g) => (
            <li key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{g.name}</span>
              <button type="button" className="btn-secondary" style={{ width: 'auto', padding: '4px 10px', minHeight: 32, fontSize: '0.8rem' }} onClick={() => handleRemove(g.id)}>Xóa</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HostActions({ roomId, room, token, roundsList, setRoom, setRoundsList, showToastError }) {
  const [undoing, setUndoing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [swapValue, setSwapValue] = useState('');
  const hostKey = getCurrentHostKey(room);
  const ownerId = room?.owner_id?._id ?? room?.owner_id ?? room?.host_id?._id ?? room?.host_id;
  const ownerUser = room?.players?.find((p) => String(p._id || p) === String(ownerId));
  const swapOptions = [];
  if (ownerUser && String(ownerUser._id || ownerUser) !== hostKey) swapOptions.push({ type: 'user', id: ownerUser._id || ownerUser, label: `${ownerUser.username || '—'} (tài khoản)` });
  (room?.guests || []).forEach((g) => {
    if (`g:${g.id}` !== hostKey) swapOptions.push({ type: 'guest', id: g.id, label: g.name || '—' });
  });

  const handleUndo = async () => {
    if (roundsList.length === 0 || undoing) return;
    setUndoing(true);
    try {
      await rounds(token).undoLast(roomId);
      // UI cập nhật qua socket 'round_undo', không cập nhật local để tránh xóa 2 dòng (host vừa gọi API vừa nhận broadcast)
    } finally {
      setUndoing(false);
    }
  };
  const handleSwap = async (e) => {
    e.preventDefault();
    if (!swapValue) return;
    const opt = swapOptions.find((o) => (o.type === 'user' ? String(o.id) : `g:${o.id}`) === swapValue);
    if (!opt) return;
    const payload = opt.type === 'user' ? { newHostUserId: opt.id } : { newHostGuestId: opt.id };
    try { const updated = await rooms(token).swapHost(roomId, payload); setRoom(updated); setSwapValue(''); }
    catch (err) { showToastError?.(err.message); }
  };
  const openEndConfirm = () => setShowEndConfirm(true);
  const closeEndConfirm = () => setShowEndConfirm(false);
  const handleEndConfirm = async () => {
    setEnding(true);
    try {
      const updated = await rooms(token).end(roomId);
      setRoom(updated);
      setShowEndConfirm(false);
    } catch (err) {
      showToastError?.(err.message);
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="section-card">
      <h2 className="section-title">Chuyển Cái</h2>
      <div className="host-actions">
        <button type="button" className="btn-secondary" onClick={handleUndo} disabled={roundsList.length === 0 || undoing}>
          {undoing ? 'Đang undo...' : 'Undo vòng vừa nhập'}
        </button>
        <form onSubmit={handleSwap} className="swap-form">
          <select value={swapValue} onChange={(e) => setSwapValue(e.target.value)}>
            <option value="">— Chọn người làm Cái —</option>
            {swapOptions.map((o) => (
              <option key={o.type + o.id} value={o.type === 'user' ? o.id : `g:${o.id}`}>{o.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-secondary" disabled={!swapValue}>Chuyển Cái</button>
        </form>
        <button type="button" className="btn-danger" onClick={openEndConfirm} disabled={ending}>
          {ending ? 'Đang kết thúc...' : 'Kết thúc game'}
        </button>
      </div>

      {showEndConfirm && (
        <div className="confirm-overlay" onClick={closeEndConfirm} role="dialog" aria-modal="true" aria-labelledby="confirm-end-title">
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-end-title" className="confirm-title">Kết thúc game?</h3>
            <p className="confirm-message">Không thể tạo thêm vòng sau khi kết thúc.</p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={closeEndConfirm} disabled={ending}>Hủy</button>
              <button type="button" className="btn-danger" onClick={handleEndConfirm} disabled={ending}>
                {ending ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
