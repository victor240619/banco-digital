#!/bin/bash

# BRAVUS BANK - DEPLOY RÁPIDO
# Execute este arquivo para iniciar tudo automaticamente

set -e

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           🚀 BRAVUS BANK - DEPLOY AUTOMÁTICO                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if running with docker
if command -v docker &> /dev/null; then
    echo "✅ Docker encontrado! Usando deploy com Docker..."
    echo ""
    
    # Backend
    echo "📦 [1/3] Iniciando Backend (Spring Boot + PostgreSQL)..."
    cd ~/banco-digital/bravus-bank
    docker-compose down 2>/dev/null || true
    rm -rf target/ 2>/dev/null || true
    
    echo "🔨 Building imagem Docker..."
    docker build --no-cache --network=host -t bravus-bank . > /dev/null 2>&1
    
    echo "🐳 Iniciando containers..."
    docker-compose up -d
    
    echo "⏳ Aguardando backend inicializar (30 segundos)..."
    sleep 30
    
    echo "✅ Backend iniciado em http://localhost:9000"
    echo ""
else
    echo "⚠️  Docker não encontrado. Configure manualmente:"
    echo "   1. Instalar PostgreSQL"
    echo "   2. Criar banco 'bravus' com usuário 'bravus'"
    echo "   3. Executar: cd bravus-bank && ./mvnw clean package && java -jar target/*.jar"
    echo ""
fi

# Frontend
echo "🎨 [2/3] Configurando Frontend (React + Vite)..."
cd /workspace/bravus-bank-frontend

if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências npm..."
    npm install --silent > /dev/null 2>&1
else
    echo "✅ Dependências já instaladas"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEPLOY CONCLUÍDO!                           ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 PRÓXIMOS PASSOS:"
echo ""
echo "1️⃣  Iniciar Frontend:"
echo "   cd /workspace/bravus-bank-frontend"
echo "   npm run dev"
echo ""
echo "2️⃣  Abrir navegador:"
echo "   http://localhost:5173"
echo ""
echo "3️⃣  Fazer login:"
echo "   👑 Admin:   admin / admin123"
echo "   👤 Usuário: user / user123"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "📚 DOCUMENTAÇÃO:"
echo "   • START-AQUI.md          → Guia rápido"
echo "   • README-BRAVUS-BANK.md  → Documentação completa"
echo "   • INSTRUCOES-DEPLOY.md   → Deploy detalhado"
echo ""
echo "🧪 TESTAR BACKEND:"
echo "   curl http://localhost:9000/api/auth/login \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
echo ""
echo "✨ Sistema pronto! Boa exploração! 🚀"
echo ""
