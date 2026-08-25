#!/bin/sh
# ============================================================================
# Vault persistent entrypoint — thay cho chế độ dev (secret nằm trên RAM).
# Nhiệm vụ:
#   1. Sinh config server thật với file storage (dữ liệu nằm trên volume)
#   2. Khởi động server nền, đợi API phản hồi
#   3. Lần đầu: tự `vault operator init`, LƯU unseal key + root token vào
#      /vault/data/init-keys.json (nằm trên volume — hãy sao lưu file này!)
#   4. Các lần sau: tự unseal bằng key đã lưu
#   5. Đảm bảo mount KV v2 'secret/' tồn tại (dev mode có sẵn, server mode thì không)
#   6. Tạo token có ID 'root' để mcp-gateway (VAULT_TOKEN=root) chạy tiếp
#      không cần sửa .env
#
# LƯU Ý PARSE: `vault operator init -format=json` xuất JSON ĐA DÒNG (pretty)
# nên tách bằng sed một-dòng là hỏng — dùng output plain text thay thế.
# ============================================================================
set -eu

# QUAN TRỌNG: Vault CLI mặc định gọi https://127.0.0.1:8200, trong khi
# listener của ta tắt TLS (http). Không set này thì mọi lệnh status/init/
# unseal trong script đều thất bại và vault kẹt ở trạng thái sealed.
export VAULT_ADDR="http://127.0.0.1:8200"

VAULT_DIR="/vault/data"
CONFIG_FILE="/vault/config.hcl"
KEY_FILE="$VAULT_DIR/init-keys.json"

# --- 1. Config server (file storage, không TLS trong mạng nội bộ Docker) ---
cat > "$CONFIG_FILE" <<'EOF'
storage "file" {
  path = "/vault/data/store"
}
listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = true
}
ui = true
disable_mlock = true
EOF

# --- 2. Chạy server nền và đợi API thực sự phản hồi ---
# (grep '"initialized"' chỉ khớp khi server đã trả JSON — tránh break sớm
#  do exit-code của `vault status` khi server chưa lên)
vault server -config="$CONFIG_FILE" > /vault/server.log 2>&1 &

i=0
until vault status -format=json 2>/dev/null | grep -q '"initialized"'; do
  i=$((i + 1))
  if [ "$i" -gt 30 ]; then
    echo "FATAL: Vault server không phản hồi sau 30s — xem /vault/server.log"
    tail -20 /vault/server.log || true
    exit 1
  fi
  sleep 1
done

STATUS_JSON=$(vault status -format=json 2>/dev/null || true)

# --- 3/4. Lấy unseal key + root token: init mới hoặc đọc từ file đã lưu ---
if printf '%s' "$STATUS_JSON" | grep -q '"initialized": false'; then
  # Chưa init — dùng output PLAIN TEXT (dễ parse, không phụ thuộc định dạng JSON)
  INIT_OUT=$(vault operator init -key-shares=1 -key-threshold=1)
  UNSEAL_KEY=$(printf '%s\n' "$INIT_OUT" | sed -n 's/^Unseal Key 1: //p' | tr -d '\r')
  ROOT_TOKEN=$(printf '%s\n' "$INIT_OUT" | sed -n 's/^Initial Root Token: //p' | tr -d '\r')
  if [ -z "$UNSEAL_KEY" ] || [ -z "$ROOT_TOKEN" ]; then
    echo "FATAL: không tách được unseal key/root token từ kết quả init:"
    printf '%s\n' "$INIT_OUT"
    exit 1
  fi
  printf 'unseal_key=%s\nroot_token=%s\n' "$UNSEAL_KEY" "$ROOT_TOKEN" > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  echo "==============================================================="
  echo "[vault-entrypoint] KHỞI TẠO LẦN ĐẦU — đã lưu key vào $KEY_FILE"
  echo "[vault-entrypoint] Root token: $ROOT_TOKEN"
  echo "[vault-entrypoint] QUAN TRỌNG: sao lưu file $KEY_FILE ra nơi an toàn"
  echo "[vault-entrypoint] (nó nằm trên volume, mất volume là mất key!)."
  echo "==============================================================="
elif [ -f "$KEY_FILE" ]; then
  UNSEAL_KEY=$(sed -n 's/^unseal_key=//p' "$KEY_FILE" | tr -d '\r')
  ROOT_TOKEN=$(sed -n 's/^root_token=//p' "$KEY_FILE" | tr -d '\r')
  if [ -z "$UNSEAL_KEY" ] || [ -z "$ROOT_TOKEN" ]; then
    echo "FATAL: Vault đã khởi tạo nhưng file $KEY_FILE hỏng/thiếu trường."
    echo "Không thể unseal mà không có key. Khôi phục từ bản sao lưu file này,"
    echo "hoặc xóa volume vault_data để khởi tạo lại (MẤT TOÀN BỘ SECRET)."
    exit 1
  fi
else
  echo "FATAL: Vault đã khởi tạo nhưng không tìm thấy $KEY_FILE trên volume."
  echo "Khôi phục file key từ bản sao lưu, hoặc xóa volume vault_data để"
  echo "khởi tạo lại (MẤT TOÀN BỘ SECRET)."
  exit 1
fi

# --- Unseal nếu còn sealed (sau init hoặc sau restart) ---
if printf '%s' "$STATUS_JSON" | grep -q '"sealed": true'; then
  vault operator unseal "$UNSEAL_KEY" >/dev/null
  echo "[vault-entrypoint] Đã unseal"
fi

# Sau unseal mới có thể thao tác API — dùng root token vừa có
export VAULT_TOKEN="$ROOT_TOKEN"

# --- 5. Đảm bảo KV v2 tại 'secret/' (path mà gateway đang dùng) ---
vault secrets enable -path=secret kv-v2 >/dev/null 2>&1 \
  || true   # đã tồn tại thì bỏ qua

# --- 6. Token ID 'root' cho mcp-gateway ---
if ! vault token lookup root >/dev/null 2>&1; then
  if vault token create -id=root -policy=root >/dev/null 2>&1; then
    echo "[vault-entrypoint] Đã tạo token 'root' cho mcp-gateway"
  else
    echo "[vault-entrypoint] CẢNH BÁO: không tạo được token ID 'root'."
    echo "[vault-entrypoint] Hãy copy root_token trong $KEY_FILE vào"
    echo "[vault-entrypoint] VAULT_TOKEN (apps/mcp-gateway/.env) rồi restart mcp-gateway."
  fi
fi

echo "[vault-entrypoint] Vault sẵn sàng tại http://0.0.0.0:8200 (persistent storage)"

# --- Giữ container sống cùng tiến trình server ---
wait
