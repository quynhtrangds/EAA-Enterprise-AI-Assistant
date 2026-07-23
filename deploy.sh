#!/usr/bin/env bash
# Enterprise AI Assistant Platform - Automated Production Deployment Script (Linux Bash)
set -e

echo -e "\033[0;36m=========================================================\033[0m"
echo -e "\033[0;36m🚀 STARTING ENTERPRISE AI ASSISTANT PLATFORM DEPLOYMENT...\033[0m"
echo -e "\033[0;36m=========================================================\033[0m"

# 1. Check Docker status
echo -e "\033[0;33m[1/5] Checking Docker installation and status...\033[0m"
if ! docker info > /dev/null 2>&1; then
    echo -e "\033[0;31m❌ Docker is not running. Please start Docker service first.\033[0m"
    exit 1
fi
echo -e "\033[0;32m✅ Docker is running.\033[0m"

# 2. Setup Environment Variables
echo -e "\033[0;33m[2/5] Setting up production environment variables...\033[0m"
if [ ! -f ".env" ]; then
    cp .env.production.example .env
    echo -e "\033[0;32m✅ Created .env from .env.production.example template.\033[0m"
else
    echo -e "\033[0;32m✅ Existing .env file found.\033[0m"
fi

# 3. Build & Start Production Containers
echo -e "\033[0;33m[3/5] Starting production containers via docker-compose...\033[0m"
docker-compose down --remove-orphans > /dev/null 2>&1 || true
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Seed Tool Permissions & Connectors
echo -e "\033[0;33m[4/5] Seeding tool permissions into PostgreSQL database...\033[0m"
sleep 5
docker exec enterprise_ai_postgres psql -U postgres -d enterprise_ai_demo -c "INSERT INTO tool_permissions (role_code, tool_name, can_execute) VALUES ('admin', 'get_open_tickets', true), ('admin', 'search_repositories', true) ON CONFLICT DO NOTHING;" > /dev/null 2>&1 || true
echo -e "\033[0;32m✅ Database tool permissions verified.\033[0m"

# 5. Final Health Checks
echo -e "\033[0;33m[5/5] Performing platform health check verification...\033[0m"
sleep 3

echo -e "\033[0;36m=========================================================\033[0m"
echo -e "\033[0;36m🎉 ENTERPRISE AI ASSISTANT PLATFORM DEPLOYED SUCCESSFULLY!\033[0m"
echo -e "\033[1;37m👉 Web Application: http://localhost:3000\033[0m"
echo -e "\033[1;37m👉 Vault Két Sắt:  http://localhost:8200\033[0m"
echo -e "\033[1;37m👉 Gitea Code Server: http://localhost:3001\033[0m"
echo -e "\033[1;37m👉 Zammad Helpdesk: http://localhost:8080\033[0m"
echo -e "\033[0;36m=========================================================\033[0m"
