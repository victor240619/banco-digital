#!/usr/bin/env bash
# =============================================================
# Bravus Bank — dev-up.sh
# Sobe DB + API com Docker Compose de forma idempotente.
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

GREEN="\033[1;32m"; RED="\033[1;31m"; YELLOW="\033[1;33m"; NC="\033[0m"

# 1) .env existe?
if [[ ! -f .env ]]; then
  echo -e "${YELLOW}⚠️  .env não encontrado. Criando a partir de .env.example...${NC}"
  cp .env.example .env

  # Gerar JWT_SECRET aleatório
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -base64 64 | tr -d '\n' | tr -d '/')
    # macOS sed vs GNU sed
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
    else
      sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env
    fi
    echo -e "${GREEN}✅ JWT_SECRET gerado automaticamente.${NC}"
  else
    echo -e "${RED}❌ openssl não encontrado. Edite .env e defina JWT_SECRET manualmente.${NC}"
    exit 1
  fi
fi

# 2) Docker disponível?
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}❌ Docker não encontrado. Instale: https://docs.docker.com/engine/install/${NC}"
  exit 1
fi

# 3) Compose plugin v2 vs docker-compose v1
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo -e "${RED}❌ docker compose plugin não encontrado.${NC}"
  exit 1
fi

echo -e "${GREEN}🚀 Subindo Bravus Bank...${NC}"
$COMPOSE up -d --build

echo ""
echo -e "${GREEN}⏳ Aguardando API ficar saudável...${NC}"
for i in {1..30}; do
  if curl -sf http://localhost:9000/actuator/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API OK em http://localhost:9000${NC}"
    break
  fi
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo -e "${YELLOW}⚠️  API ainda não respondeu. Veja logs: $COMPOSE logs -f bravus-bank${NC}"
  fi
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}🏦  Bravus Bank rodando!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo "  🔌 API ............ http://localhost:9000"
echo "  💚 Health ......... http://localhost:9000/actuator/health"
echo "  🐘 Postgres ....... localhost:5432 (db=${DB_NAME:-bravus})"
echo ""
echo "  👤 Login de teste:"
echo "     admin / admin123   (ROLE_ADMIN)"
echo "     user  / user123    (ROLE_USER)"
echo ""
echo "  📊 Frontend:  cd ../bravus-bank-frontend && npm run dev"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
