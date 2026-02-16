# Web App Tính Điểm Trò Chơi

Ứng dụng web cho phép đăng nhập, tạo/tham gia phòng, chơi game tính điểm theo nhiều vòng với hai vai trò **Host (Cái)** và **Player (Con)**. Game kết thúc khi Host chọn Manual Stop.

## Yêu cầu

- Node.js 18+
- MongoDB (local hoặc [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

## Cấu trúc

- `backend/` — API Express + Socket.io, MongoDB (Mongoose)
- `frontend/` — React (Vite), Socket.io client

## Cài đặt & Chạy

### 1. Backend

```bash
cd game-scoring/backend
npm install
```

Tạo file `.env` (copy từ `.env.example`):

```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/game_scoring
JWT_SECRET=do-doi-secret-nay-trong-moi-truong-thuc
```

- **MongoDB local**: chạy MongoDB trên máy, dùng `MONGODB_URI=mongodb://127.0.0.1:27017/game_scoring`
- **MongoDB Atlas**: tạo cluster, lấy connection string và dán vào `MONGODB_URI`

Chạy server:

```bash
npm run dev
```

Server chạy tại `http://localhost:3001`.

### 2. Frontend

```bash
cd game-scoring/frontend
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`. Frontend proxy `/api` và `/socket.io` sang backend 3001.

## Chức năng chính

- **Đăng ký / Đăng nhập** — JWT, lưu token trong localStorage
- **Tạo phòng** — User tạo phòng và trở thành Host
- **Tham gia phòng** — User khác vào phòng làm Player (Con)
- **Nhập điểm (chỉ Host)** — Host nhập điểm từng vòng cho từng Con; điểm Cái = -(Tổng Con), tổng bàn = 0
- **Undo** — Host chỉ undo được vòng vừa nhập
- **Chuyển quyền Cái** — Host có thể swap cho một Con (có hiệu lực từ vòng kế tiếp)
- **Kết thúc game** — Host chọn "Manual Stop" → phòng chuyển ended, không tạo vòng mới
- **Realtime** — Player xem điểm cập nhật ngay qua Socket.io
- **Một Host một thiết bị** — Không cho Host mở 2 browser/tab cùng lúc (claim host theo socket)

## Luật tính điểm

- Mỗi vòng: Host nhập điểm cho từng Con (số dương, âm hoặc 0). Thiếu = 0.
- **Tổng Con** = tổng điểm tất cả Con trong vòng.
- **Điểm Cái** = - (Tổng Con) → tổng điểm toàn bàn luôn bằng 0.
- Lưu cả điểm từng vòng và điểm tích lũy.

## Cấu trúc dữ liệu (MongoDB)

- **users** — username, password_hash, created_at
- **rooms** — name, status (active | ended), host_id, players[], created_at, ended_at
- **rounds** — room_id, round_number, scores[{ user_id, round_score, cumulative_score }], host_score, host_cumulative, created_by, created_at

## Công nghệ

- Backend: Express, Mongoose, Socket.io, bcryptjs, jsonwebtoken
- Frontend: React 18, React Router, Vite, Socket.io-client
