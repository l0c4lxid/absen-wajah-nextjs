# Hospital Attendance - Face Recognition (Next.js)

Aplikasi absensi rumah sakit berbasis pengenalan wajah menggunakan Next.js (App Router), MongoDB, dan `@vladmandic/face-api`.

## Fitur Utama

- Registrasi wajah dengan **continuous modeling** (multi-frame, quality check, progress).
- Kiosk absensi otomatis berbasis wajah.
- Validasi konflik user saat register:
  - `employeeId` sudah ada.
  - Wajah mirip user lain (mencegah salah register).
- CRUD user management (list, search, edit, delete + konfirmasi `employeeId`).
- Dokumentasi API via Swagger UI di `/docs`.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- MongoDB + Mongoose
- `@vladmandic/face-api`

## Struktur Halaman

- `/` - Landing dashboard
- `/register` - Face registration + form staff + panel CRUD user
- `/kiosk` - Scanner absensi
- `/docs` - Redirect ke Swagger docs
- `/docs/swagger` - Swagger UI (React component: `swagger-ui-react`)

## Environment

Buat file `.env.local`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/hospital-attendance
```

## Menjalankan Project

```bash
npm install
npm run dev
```

Mode HTTPS lokal (disarankan untuk kamera mobile):

```bash
npm run dev:https
```

Akses aplikasi:

- `http://localhost:3000`
- atau `https://localhost:3000` (mode HTTPS)

## API Endpoints

### User

- `POST /api/user/register` - register / overwrite user (dengan `confirmOverwrite`)
- `POST /api/user/identify` - identifikasi wajah dari descriptor
- `POST /api/user/validate` - validasi `employeeId` + cek konflik wajah
- `GET /api/users` - list user (support `q`, `limit`)
- `POST /api/users` - create user baru
- `GET /api/users/{id}` - detail user
- `PUT /api/users/{id}` - update user
- `DELETE /api/users/{id}` - delete user (wajib `confirmEmployeeId`)

### Attendance

- `POST /api/attendance/log` - catat check-in/check-out

### System

- `POST /api/reset-db` - reset data user + attendance
- `GET /api/docs` - OpenAPI JSON spec

## Swagger Docs

Buka:

- `http://localhost:3000/docs`

`/docs` akan redirect ke `/docs/swagger`, lalu load OpenAPI dari `/api/docs`.

## Script

- `npm run dev` - dev server HTTP
- `npm run dev:https` - dev server HTTPS
- `npm run build` - build production
- `npm run start` - run production server
- `npm run lint` - lint

## Catatan Mobile Camera

Untuk browser mobile, gunakan HTTPS agar izin kamera lebih stabil.
Jika scan macet, lakukan hard refresh tab lalu pastikan permission kamera diizinkan.
