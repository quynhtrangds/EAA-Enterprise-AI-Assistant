# Chat UI

Giao diện chat tiếng Việt cho Enterprise AI Assistant.  
Xây dựng bằng **React 19 + TypeScript + Vite + Tailwind CSS v4**.

## Tính năng

- Đăng nhập với tài khoản doanh nghiệp (admin / manager / staff / viewer)
- Gửi câu hỏi bằng tiếng Việt và nhận câu trả lời từ AI
- Hiển thị danh sách tool calls AI đã thực hiện (minh bạch)
- Hỗ trợ nhiều session chat
- Dark mode sidebar, responsive layout
- Render markdown trong câu trả lời (bảng, danh sách, in đậm...)

## Chạy local

```powershell
npm install
npm run dev      # http://localhost:3000
```

> AI Orchestrator phải đang chạy tại `http://localhost:8082`.

## Scripts

| Script           | Mô tả                                 |
|------------------|---------------------------------------|
| `npm run dev`    | Khởi động dev server (Vite HMR)       |
| `npm run build`  | Build production                      |
| `npm run lint`   | Kiểm tra code với Oxlint              |
| `npm run test`   | Chạy unit tests (Vitest)              |
| `npm run test:e2e` | Chạy E2E tests (Playwright)         |

## Cấu trúc thư mục

```
src/
  components/     Các React component (ChatWindow, Sidebar, LoginForm, ...)
  contexts/       React context (AuthContext, ChatContext)
  hooks/          Custom hooks (useChat, useAuth)
  types/          TypeScript type definitions
  App.tsx         Root component
  main.tsx        Entry point
e2e/              E2E tests bằng Playwright
```

## Tài khoản mặc định

| Username | Mật khẩu   | Vai trò  |
|----------|------------|----------|
| admin    | admin123   | admin    |
| manager  | manager123 | manager  |
| staff    | staff123   | staff    |
| viewer   | viewer123  | viewer   |
