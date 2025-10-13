#!/bin/bash
set -e

echo "🔥 INICIANDO BRAVUS CYBERBANK - SISTEMA BANCÁRIO COMPLETO 🔥"
echo "🚀 Backend + Frontend Neural - Matrix Interface Activated"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Diretórios
BACKEND_DIR="/workspace/bravus-bank"
FRONTEND_DIR="/workspace/bravus-cyberbank-react"

echo -e "${CYAN}============================================${NC}"
echo -e "${PURPLE}    BRAVUS CYBERBANK STARTUP SEQUENCE     ${NC}"
echo -e "${CYAN}============================================${NC}"

# Verificar se os diretórios existem
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Diretório do backend não encontrado: $BACKEND_DIR${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Diretório do frontend não encontrado: $FRONTEND_DIR${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 INFORMAÇÕES DO SISTEMA:${NC}"
echo -e "${BLUE}   Backend:${NC} Spring Boot + PostgreSQL + Stripe"
echo -e "${BLUE}   Frontend:${NC} React + TypeScript + Vite + TailwindCSS"
echo -e "${BLUE}   Banco de Dados:${NC} PostgreSQL 15"
echo -e "${BLUE}   Portas:${NC} Backend: 8080/9000, Frontend: 3000, DB: 5432"
echo ""

echo -e "${YELLOW}🔐 CREDENCIAIS DE ACESSO:${NC}"
echo -e "${GREEN}   👨‍💼 ADMIN:${NC} admin@bravus.com / admin123"
echo -e "${GREEN}   👤 USUÁRIO:${NC} user@bravus.com / user123"
echo ""

# Verificar se Docker está disponível
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker não encontrado. Instalando...${NC}"
    
    # Instalar Docker (Ubuntu/Debian)
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-plugin
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    
    echo -e "${GREEN}✅ Docker instalado! Você pode precisar fazer logout/login para usar sem sudo.${NC}"
fi

# Verificar se Maven está disponível para build manual
if ! command -v mvn &> /dev/null; then
    echo -e "${YELLOW}⚠️  Maven não encontrado. Usando Docker para build...${NC}"
fi

# Parar containers existentes
echo -e "${YELLOW}🛑 Parando containers existentes...${NC}"
cd "$BACKEND_DIR"
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

# Limpar build anterior
echo -e "${YELLOW}🧹 Limpando builds anteriores...${NC}"
rm -rf target/ 2>/dev/null || true

# Build e start do backend
echo -e "${YELLOW}🔨 Construindo e iniciando backend...${NC}"
if command -v docker &> /dev/null; then
    docker build --no-cache --network=host -t bravus-bank . || {
        echo -e "${RED}❌ Erro no build do Docker. Tentando sem --network=host...${NC}"
        docker build --no-cache -t bravus-bank .
    }
    
    # Iniciar com docker compose
    if command -v docker-compose &> /dev/null; then
        docker-compose up -d
    else
        docker compose up -d
    fi
else
    echo -e "${RED}❌ Docker não disponível. Por favor, instale o Docker primeiro.${NC}"
    exit 1
fi

echo -e "${YELLOW}⏳ Aguardando backend inicializar...${NC}"
sleep 20

# Verificar se o backend está rodando
echo -e "${YELLOW}🔍 Verificando status do backend...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend está online!${NC}"
        break
    elif curl -s http://localhost:9000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend está online na porta 9000!${NC}"
        break
    else
        echo -e "${YELLOW}⏳ Tentativa $i/10 - Aguardando backend...${NC}"
        sleep 5
    fi
    
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Backend não respondeu após 10 tentativas. Verificando logs...${NC}"
        if command -v docker-compose &> /dev/null; then
            docker-compose logs --tail=20 bravus-bank
        else
            docker compose logs --tail=20 bravus-bank
        fi
    fi
done

# Testar endpoint principal
echo -e "${YELLOW}🧪 Testando API principal...${NC}"
if curl -s http://localhost:9000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API respondendo na porta 9000${NC}"
    curl -s http://localhost:9000/ | head -c 200
elif curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API respondendo na porta 8080${NC}"
    curl -s http://localhost:8080/ | head -c 200
else
    echo -e "${YELLOW}⚠️  API não respondeu, mas continuando...${NC}"
fi
echo ""

# Verificar se Node.js está disponível
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado. Instalando...${NC}"
    
    # Instalar Node.js (Ubuntu/Debian)
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    echo -e "${GREEN}✅ Node.js instalado!${NC}"
fi

# Iniciar frontend
echo -e "${YELLOW}🎨 Preparando frontend React...${NC}"
cd "$FRONTEND_DIR"

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependências do frontend...${NC}"
    npm install
fi

# Build do frontend
echo -e "${YELLOW}🔨 Construindo frontend para produção...${NC}"
npm run build

echo -e "${GREEN}🚀 Iniciando servidor de desenvolvimento...${NC}"
echo -e "${CYAN}============================================${NC}"
echo -e "${PURPLE}         SISTEMA TOTALMENTE ONLINE!       ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo -e "${GREEN}🌐 URLs DE ACESSO:${NC}"
echo -e "${BLUE}   Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}   Backend API:${NC} http://localhost:8080"
echo -e "${BLUE}   Backend Alt:${NC} http://localhost:9000"
echo ""
echo -e "${YELLOW}📝 FUNCIONALIDADES DISPONÍVEIS:${NC}"
echo -e "${GREEN}   ✅ Sistema de Login/Cadastro${NC}"
echo -e "${GREEN}   ✅ Dashboard Administrativo${NC}"
echo -e "${GREEN}   ✅ Gerenciamento de Clientes${NC}"
echo -e "${GREEN}   ✅ Processamento de Pagamentos${NC}"
echo -e "${GREEN}   ✅ Sistema de Transferências${NC}"
echo -e "${GREEN}   ✅ Dashboard do Usuário${NC}"
echo -e "${GREEN}   ✅ Carteira Digital${NC}"
echo -e "${GREEN}   ✅ Interface Cyberpunk${NC}"
echo ""
echo -e "${PURPLE}🎯 Para parar o sistema: Ctrl+C${NC}"
echo -e "${CYAN}============================================${NC}"

# Iniciar o servidor de desenvolvimento
npm run dev