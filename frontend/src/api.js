const API = '/api';

export async function apiFetch(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const auth = {
  login: (username, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username, password) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
};

export function rooms(token) {
  return {
    list: () => apiFetch('/rooms', {}, token),
    get: (id) => apiFetch(`/rooms/${id}`, {}, token),
    getPublic: (id) => apiFetch(`/rooms/${id}/public`),
    create: (name) => apiFetch('/rooms', { method: 'POST', body: JSON.stringify({ name }) }, token),
    join: (id) => apiFetch(`/rooms/${id}/join`, { method: 'POST' }, token),
    swapHost: (id, payload) => apiFetch(`/rooms/${id}/swap-host`, { method: 'POST', body: JSON.stringify(payload) }, token),
    end: (id) => apiFetch(`/rooms/${id}/end`, { method: 'POST' }, token),
    leave: (id) => apiFetch(`/rooms/${id}/leave`, { method: 'POST' }, token),
    addGuest: (id, name) => apiFetch(`/rooms/${id}/guests`, { method: 'POST', body: JSON.stringify({ name }) }, token),
    removeGuest: (id, guestId) => apiFetch(`/rooms/${id}/guests/${guestId}`, { method: 'DELETE' }, token),
  };
}

export function rounds(token) {
  return {
    list: (roomId) => apiFetch(`/rounds/room/${roomId}`, {}, token),
    listPublic: (roomId) => apiFetch(`/rounds/room/${roomId}/public`),
    submit: (roomId, scores) => apiFetch(`/rounds/room/${roomId}`, { method: 'POST', body: JSON.stringify({ scores }) }, token),
    undoLast: (roomId) => apiFetch(`/rounds/room/${roomId}/last`, { method: 'DELETE' }, token),
  };
}
