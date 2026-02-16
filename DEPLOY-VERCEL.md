# Deploy lên Vercel

App có **frontend (React)** và **backend (Node + Socket.io)**. Vercel chỉ deploy được **frontend**. Backend cần chạy trên dịch vụ khác (Railway, Render, Fly.io…).

---

## 1. Deploy Backend (bắt buộc trước)

Vercel **không** chạy server Node + Socket.io lâu dài, nên backend phải deploy riêng.

### Gợi ý: Railway (free tier)

1. Vào [railway.app](https://railway.app), đăng nhập bằng GitHub.
2. **New Project** → **Deploy from GitHub repo** → chọn repo `game-scoring`.
3. **Quan trọng:** Trong cài đặt service, đặt **Root Directory** = `backend` (nếu không sẽ lỗi *"Error creating build plan with Railpack"* vì repo có cả frontend + backend).
4. **Variables** (giống `.env`):
   - `PORT` = `3001` (Railway tự gán port qua `process.env.PORT`)
   - `MONGODB_URI` = connection string MongoDB Atlas của bạn
   - `JWT_SECRET` = chuỗi bí mật bất kỳ (dài, random)
5. **Settings** → **Networking** → **Generate Domain** → copy URL (vd: `https://game-scoring-production-xxxx.up.railway.app`).

**Nếu build bị lỗi "Error creating build plan with Railpack":** Vào **Service** → **Settings** → **Root Directory** → nhập `backend` → **Redeploy**.

### CORS backend

Backend đã bật `cors({ origin: true })`, nên mọi domain (kể cả Vercel) đều gọi API được. Nếu muốn chặn chỉ domain của bạn, sửa `server.js`:

```js
app.use(cors({ origin: 'https://your-app.vercel.app', credentials: true }));
```

---

## 2. Deploy Frontend lên Vercel

### Bước 1: Import project

1. Vào [vercel.com](https://vercel.com), đăng nhập (GitHub).
2. **Add New** → **Project** → chọn repo `realthdat/game-scoring`.
3. **Root Directory**: chọn **frontend** (bắt buộc).
4. **Framework Preset**: Vite (tự nhận hoặc chọn tay).

### Bước 2: Biến môi trường

Trong **Environment Variables** thêm:

| Name             | Value                                      |
|------------------|--------------------------------------------|
| `VITE_API_BASE`  | URL backend (vd: `https://xxx.up.railway.app`) |

- **Không** có dấu `/` ở cuối.
- Ví dụ: `https://game-scoring-production-xxxx.up.railway.app`

### Bước 3: Deploy

Bấm **Deploy**. Vercel sẽ:

- `npm install` trong `frontend/`
- `npm run build` (Vite build)
- Host thư mục `frontend/dist`

Sau khi xong, bạn có URL dạng `https://game-scoring-xxx.vercel.app`.

---

## 3. Kiểm tra

- Mở URL Vercel → đăng nhập / đăng ký.
- Tạo phòng, nhập điểm: API và Socket.io đều gọi tới backend qua `VITE_API_BASE`.
- Nếu lỗi CORS hoặc 404: kiểm tra lại `VITE_API_BASE` và CORS trên backend.

---

## Tóm tắt

| Thành phần | Nơi deploy      | Ghi chú |
|------------|-----------------|--------|
| Frontend   | **Vercel**      | Root = `frontend`, env `VITE_API_BASE` = URL backend |
| Backend    | **Railway / Render / …** | Cần MongoDB (Atlas), env `MONGODB_URI`, `JWT_SECRET` |

File `frontend/vercel.json` đã cấu hình rewrite cho React Router (SPA): mọi route đều trả về `index.html`.
