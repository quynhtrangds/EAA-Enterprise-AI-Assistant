# Hướng dẫn Triển khai Nền tảng Enterprise AI Assistant (Deployment Manual)

Tài liệu này hướng dẫn chi tiết quy trình đóng gói, triển khai và vận hành hệ thống **Enterprise AI Assistant Platform** cho các doanh nghiệp theo mô hình **On-Premise** (Private Cloud/Mạng nội bộ tuyệt đối) hoặc **Hybrid** (On-Premise Gateway + Cloud LLM/Cloud ERP).

---

## 🏗️ 1. Kiến trúc Hệ thống (System Architecture)

Hệ thống bao gồm các lớp thành phần độc lập, mở rộng linh hoạt:

```
                  [Trình duyệt Doanh nghiệp (User Client)]
                                    │
                                    ▼
                [Chat UI Application (React / Port 3000)]
                                    │ (SSO Google / OAuth2 GitHub)
                                    ▼
              [AI Orchestrator Service (Node.js / Port 8082)]
                                    │ (REST / JSON-RPC)
                                    ▼
               [MCP Gateway Engine (Node.js / Port 8081)]
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    │ (Bảo mật Mật khẩu)            │ (Phân quyền & Audit Logs)     │ (Truy vấn Dữ liệu)
    ▼                               ▼                               ▼
[HashiCorp Vault]         [PostgreSQL Database]       [Enterprise Connectors (MCP)]
 (Port 8200)               (Port 55432)                     │
                                             ┌──────────────┼──────────────┬──────────────┐
                                             ▼              ▼              ▼              ▼
                                        [ERPNext]        [CRM]         [Zammad]        [Gitea]
                                       (Kho hàng)     (Khách hàng)    (Helpdesk)     (Mã nguồn)
```

---

## 📦 2. Các Mô hình Triển khai (Deployment Models)

### Mô hình A: On-Premise (100% Nội bộ / Air-Gapped)
- **Đặc điểm**: Toàn bộ hệ thống bao gồm CSDL PostgreSQL, HashiCorp Vault, MCP Gateway, AI Orchestrator, Zammad và Gitea đều chạy trong mạng LAN nội bộ doanh nghiệp.
- **Bảo mật**: Tuyệt đối 100%, không gửi bất kỳ dữ liệu nhạy cảm ra môi trường Internet.

### Mô hình B: Hybrid Mode (Kết nối Linh hoạt)
- **Đặc điểm**: MCP Gateway chạy On-Premise tại doanh nghiệp để bảo vệ cơ sở dữ liệu nội bộ, kết nối bảo mật tới các ứng dụng Cloud (ERPNext Cloud, Frappe Cloud, GitHub).

---

## 🚀 3. Quy trình Triển khai 1-Click (1-Click Deployment)

### Yêu cầu Tiền đề (Prerequisites)
1. **Docker Desktop** / **Docker Engine** (phiên bản 20.10+ trở lên)
2. **Docker Compose** (phiên bản 2.0+ trở lên)

---

### Các bước Thực hiện:

#### Bước 1: Clone Kho mã nguồn Nền tảng
```bash
git clone https://github.com/quynhtrangds/EAA-Enterprise-AI-Assistant.git
cd EAA-Enterprise-AI-Assistant/SPEC_MVP
```

#### Bước 2: Chạy kịch bản Triển khai Tự động
- **Trên Windows Server (PowerShell):**
  ```powershell
  .\deploy.ps1
  ```

- **Trên Linux / Ubuntu Server (Bash):**
  ```bash
  chmod +x deploy.sh
  ./deploy.sh
  ```

---

## 🌐 4. Danh mục Cổng Dịch vụ (Service Endpoints)

Sau khi triển khai thành công, các dịch vụ sẽ hoạt động tại các địa chỉ sau:

| Dịch vụ | Mục đích | Cổng (Port) | Địa chỉ URL |
| :--- | :--- | :--- | :--- |
| **Chat UI** | Giao diện Hỏi-Đáp AI cho Nhân viên | `3000` | `http://localhost:3000` |
| **MCP Gateway** | Trạm quản lý công cụ Backend REST API | `8081` | `http://localhost:8081/health` |
| **AI Orchestrator** | Bộ điều phối LLM Backend REST API | `8082` | `http://localhost:8082/health` |
| **HashiCorp Vault** | Két sắt lưu an toàn API Keys / Passwords | `8200` | `http://localhost:8200` |
| **Gitea Server** | Quản lý kho mã nguồn doanh nghiệp | `3001` | `http://localhost:3001` |
| **Zammad Server** | Quản lý Ticket & Hỗ trợ khách hàng | `8080` | `http://localhost:8080` |
| **PostgreSQL** | Cơ sở dữ liệu (DBeaver / pgAdmin / TablePlus) | `55432` | `postgresql://postgres:postgres@localhost:55432/enterprise_ai_demo` |

---

## 🛡️ 5. Quy trình Sao lưu & Khôi phục Dữ liệu (Backup & Disaster Recovery)

### A. Sao lưu Cơ sở Dữ liệu PostgreSQL
```bash
docker exec enterprise_ai_postgres pg_dump -U postgres enterprise_ai_demo > backup_enterprise_ai_$(date +%Y%m%d).sql
```

### B. Sao lưu Két sắt Vault Secrets
```bash
docker exec enterprise_ai_vault vault operator raft snapshot save /vault/data/vault_backup.snap
```

### C. Khôi phục Dữ liệu PostgreSQL
```bash
cat backup_enterprise_ai_20260723.sql | docker exec -i enterprise_ai_postgres psql -U postgres -d enterprise_ai_demo
```

---

## 🩺 6. Kiểm tra Sức khỏe Hệ thống (Health Checks)

Bạn có thể kiểm tra trạng thái hoạt động của các API chính:

```bash
# Kiểm tra MCP Gateway
curl http://localhost:8081/health

# Kiểm tra AI Orchestrator
curl http://localhost:8082/health
```

---

🎉 **HỆ THỐNG ENTERPRISE AI ASSISTANT PLATFORM ĐÃ ĐƯỢC ĐÓNG GÓI CHUẨN ĐÓNG THÙNG SẴN SÀNG CHO DOANH NGHIỆP!**
