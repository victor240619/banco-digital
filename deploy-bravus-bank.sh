#!/bin/bash
set -e

echo "🚀 =========================================="
echo "🚀   BRAVUS BANK - DEPLOY COMPLETO"
echo "🚀 =========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to workspace
cd /workspace

echo -e "${BLUE}📦 [1/6] Parando containers antigos...${NC}"
cd /workspace/bravus-bank
docker-compose down 2>/dev/null || true

echo ""
echo -e "${BLUE}🧹 [2/6] Limpando build anterior...${NC}"
rm -rf target/ 2>/dev/null || true

echo ""
echo -e "${BLUE}🔨 [3/6] Building backend (Java + Spring Boot)...${NC}"
docker build --no-cache --network=host -t bravus-bank .

echo ""
echo -e "${BLUE}🐳 [4/6] Iniciando containers Docker...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}⏳ Aguardando backend inicializar (30 segundos)...${NC}"
sleep 30

echo ""
echo -e "${BLUE}📦 [5/6] Instalando dependências do frontend...${NC}"
cd /workspace/bravus-bank-frontend
npm install --silent 2>/dev/null || npm install

echo ""
echo -e "${BLUE}🎨 [6/6] Buildando frontend React...${NC}"
npm run build

echo ""
echo -e "${GREEN}✅ =========================================="
echo -e "✅   DEPLOY CONCLUÍDO COM SUCESSO!"
echo -e "✅ ==========================================${NC}"
echo ""
echo -e "${GREEN}🌐 ACESSOS:${NC}"
echo -e "${BLUE}   Backend API:  ${GREEN}http://localhost:9000${NC}"
echo -e "${BLUE}   Frontend Dev: ${GREEN}npm run dev${NC} (na pasta bravus-bank-frontend)"
echo -e "${BLUE}   Frontend:     ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}👤 CREDENCIAIS DE TESTE:${NC}"
echo -e "${BLUE}   Admin:   ${GREEN}admin / admin123${NC}"
echo -e "${BLUE}   Usuário: ${GREEN}user / user123${NC}"
echo ""
echo -e "${GREEN}🧪 TESTANDO BACKEND:${NC}"
curl -s http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | head -c 100
echo ""
echo ""
echo -e "${GREEN}✨ Sistema pronto para uso!${NC}"
echo -e "${YELLOW}📝 Para iniciar o frontend, execute:${NC}"
echo -e "${BLUE}   cd /workspace/bravus-bank-frontend && npm run dev${NC}"
echo ""
