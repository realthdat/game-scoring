# Kiểm tra Validation & Edge Cases

Tài liệu này liệt kê các validation và xử lý edge case đã triển khai theo `game-scoring-requirement.md`.

---

## §7 Validation & Edge Case (yêu cầu)

| Yêu cầu | Cách xử lý |
|--------|------------|
| Nhập thiếu Player ⇒ mặc định = 0 | Backend: `scoreMap.get(uid) ?? 0` và `toFiniteScore()` — mọi Con trong phòng đều có điểm (thiếu input = 0). |
| Hệ thống tự tính Host theo công thức | Backend: `hostScore = -totalCon`, không nhận từ client. |
| Không cho Player rời room khi game đang active | API `POST /api/rooms/:id/leave` trả 400 nếu `room.status === 'active'`. Chỉ cho rời khi `ended`. |
| Swap Host có hiệu lực từ Round kế tiếp | Round tiếp theo do Host mới submit; không sửa round cũ. |
| Host disconnect giữa Round ⇒ hủy round đang nhập | Round chỉ lưu khi submit; không có “draft round”. Host disconnect chỉ release `claim_host`, không tạo round. |

---

## Auth

- **Register:** Username 2–30 ký tự, password tối thiểu 6 ký tự (backend + frontend).
- **Login:** Bắt buộc username và password; thông báo chung “Sai username hoặc password”.

---

## Rooms

- **Params:** `id`, `roomId` kiểm tra ObjectId hợp lệ (400 "Id không hợp lệ" / "Room id không hợp lệ").
- **Tạo phòng:** Tên phòng trim, mặc định "Phòng mới", giới hạn 80 ký tự.
- **Join:** Chỉ phòng `active`; đã trong phòng thì trả room hiện tại, không push trùng.
- **Swap host:** Chỉ Host hiện tại; `newHostId` bắt buộc; không cho swap cho chính mình; người nhận phải trong `players`.
- **End:** Chỉ Host; không end lại phòng đã `ended`.
- **Leave:** Chỉ khi `status === 'ended'`; 400 khi game đang active.

---

## Rounds

- **Điểm số:** Dùng `toFiniteScore(val)` — NaN/Infinity/undefined → 0. Chỉ lưu điểm hữu hạn.
- **Thiếu Con:** Danh sách điểm build từ `room.players` (trừ host); thiếu trong body ⇒ 0.
- **Chỉ Host submit:** So sánh `room.host_id` với `req.user._id`.
- **Game đã kết thúc:** Không cho tạo round mới (400 "Game đã kết thúc").
- **Double submit:** Unique index `(room_id, round_number)`; khi trùng (11000) trả 409 "Vòng này đã được ghi. Tránh double submit."
- **Undo:** Chỉ xóa round cuối; chỉ Host; không undo khi không còn round.

---

## Realtime & Concurrency

- **Một Host một thiết bị:** `hostSessions.js` — mỗi room chỉ một socket được `claim_host`; socket khác claim cùng room ⇒ `ok: false`.
- **Disconnect:** `releaseHost(socketId)` khi socket disconnect.

---

## Frontend

- **Điểm nhập:** `Number.isFinite(n) ? n : 0` trước khi gửi.
- **Form nhập điểm:** Chỉ hiện khi Host + đã claim host + room chưa ended.
- **Nút Undo / End / Swap:** Chỉ khi `!roomEnded` và hostClaimed (Host actions).
- **Rời phòng:** Nút "Rời phòng" chỉ khi `room.status === 'ended'`; gọi `rooms(token).leave(roomId)`.

---

## Tổng điểm = 0

- Mỗi round: `host_score = -(sum of round_score of Con)`.
- Chỉ lưu điểm Con từ body (đã chuẩn hóa), Host tính server-side ⇒ tổng bàn luôn 0.
