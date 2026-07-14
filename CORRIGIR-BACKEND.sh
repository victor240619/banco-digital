#!/bin/bash
set -e

echo "CORRIGINDO BACKEND BRAVUS BANK"
echo ""

cd ~/banco-digital/bravus-bank

echo "1. Parando containers sem remover volumes..."
docker-compose down

echo ""
echo "2. Preservando volumes de banco..."
echo "   Nao execute docker-compose down -v em correcao normal: isso apaga saldos, usuarios e transacoes locais."

echo ""
echo "3. Removendo imagem antiga..."
docker rmi bravus-bank 2>/dev/null || true

echo ""
echo "4. Rebuild completo..."
docker build --no-cache -t bravus-bank .

echo ""
echo "5. Iniciando containers..."
docker-compose up -d

echo ""
echo "6. Aguardando 40 segundos para inicializacao..."
for i in {40..1}; do
    echo -ne "\rAguardando... $i segundos "
    sleep 1
done
echo ""

echo ""
echo "TESTANDO LOGIN..."
echo ""
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

echo ""
echo ""
echo "Se viu um 'token' acima, funcionou."
echo ""
echo "Agora execute:"
echo "  cd ~/banco-digital/bravus-bank-frontend && npm run dev"
