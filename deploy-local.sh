#!/bin/bash
set -e

echo "🚀 =========================================="
echo "🚀   BRAVUS BANK - DEPLOY LOCAL"
echo "🚀 =========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd /workspace

echo -e "${BLUE}📦 [1/3] Instalando dependências do frontend...${NC}"
cd /workspace/bravus-bank-frontend
npm install --silent 2>/dev/null || npm install

echo ""
echo -e "${BLUE}🎨 [2/3] Verificando estrutura do projeto...${NC}"
ls -la src/

echo ""
echo -e "${GREEN}✅ =========================================="
echo -e "✅   SETUP CONCLUÍDO COM SUCESSO!"
echo -e "✅ ==========================================${NC}"
echo ""
echo -e "${GREEN}🌐 INSTRUÇÕES:${NC}"
echo ""
echo -e "${YELLOW}BACKEND (Spring Boot):${NC}"
echo -e "  cd /workspace/bravus-bank"
echo -e "  ./mvnw clean package"
echo -e "  java -jar target/*.jar"
echo -e "  ${GREEN}→ Backend em http://localhost:9000${NC}"
echo ""
echo -e "${YELLOW}FRONTEND (React + Vite):${NC}"
echo -e "  cd /workspace/bravus-bank-frontend"
echo -e "  npm run dev"
echo -e "  ${GREEN}→ Frontend em http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}👤 CREDENCIAIS DE TESTE:${NC}"
echo -e "  ${BLUE}Admin:${NC}   admin / admin123"
echo -e "  ${BLUE}Usuário:${NC} user / user123"
echo ""
echo -e "${GREEN}✨ Sistema configurado e pronto!${NC}"
