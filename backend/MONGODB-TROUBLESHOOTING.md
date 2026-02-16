# Lỗi kết nối MongoDB (querySrv ECONNREFUSED)

## 1. Kiểm tra file `.env`

- Mở `backend/.env`.
- **Bắt buộc:** Thay `<db_password>` bằng **mật khẩu thật** của user MongoDB Atlas (pchome1st).
- Nếu mật khẩu có ký tự đặc biệt (`@`, `#`, `%`, `:`, `/`), cần [URL-encode](https://www.w3schools.com/tags/ref_urlencode.asp) (vd: `@` → `%40`).

## 2. MongoDB Atlas – Network Access

- Vào [MongoDB Atlas](https://cloud.mongodb.com) → Project → **Network Access**.
- **Add IP Address**: chọn **Allow Access from Anywhere** (`0.0.0.0/0`) để test, hoặc thêm IP máy bạn.

## 3. DNS / mạng chặn SRV (querySRV ECONNREFUSED)

Một số mạng (công ty, WiFi công cộng) chặn truy vấn DNS kiểu SRV, nên `mongodb+srv://...` không resolve được.

**Cách làm:** Dùng **Standard Connection String** (không dùng `mongodb+srv`):

1. Vào Atlas → **Database** → **Connect** → **Drivers**.
2. Chọn **Node.js**, copy **Standard connection string** (dạng `mongodb://host1:27017,host2:27017,...`).
3. Thay `<password>` bằng mật khẩu, thêm tên database: `.../game_scoring?retryWrites=true&w=majority`.
4. Gán chuỗi đó vào `MONGODB_URI` trong `.env`.

Ví dụ (thay host/port theo cluster của bạn):

```env
MONGODB_URI=mongodb://pchome1st:YOUR_PASSWORD@cluster0-shard-00-00.hdvbjee.mongodb.net:27017,cluster0-shard-00-01.hdvbjee.mongodb.net:27017,cluster0-shard-00-02.hdvbjee.mongodb.net:27017/game_scoring?ssl=true&replicaSet=atlas-xxx&authSource=admin&retryWrites=true&w=majority
```

## 4. Chạy MongoDB local (không dùng Atlas)

Nếu đã cài MongoDB trên máy:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/game_scoring
```

Sau khi sửa `.env`, khởi động lại backend: `npm run dev`.
