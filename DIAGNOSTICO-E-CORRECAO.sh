#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           🔍 DIAGNÓSTICO E CORREÇÃO - BRAVUS BANK                ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

cd ~/banco-digital/bravus-bank

echo "1️⃣ Verificando tabelas no banco de dados..."
echo "═══════════════════════════════════════════════════════════════════"
docker exec bravus-postgres psql -U bravus -d bravus -c "\dt"
echo ""

echo "2️⃣ Verificando se usuários existem..."
echo "═══════════════════════════════════════════════════════════════════"
docker exec bravus-postgres psql -U bravus -d bravus -c "SELECT username, email, is_active FROM users;" 2>&1
echo ""

echo "3️⃣ Verificando logs do backend..."
echo "═══════════════════════════════════════════════════════════════════"
docker logs bravus-bank-app 2>&1 | tail -50
echo ""

echo "════════════════════════════════════════════════════════════════════"
echo "Se NÃO viu a tabela 'users' acima, execute a CORREÇÃO:"
echo ""
echo "bash CRIAR-USUARIOS.sh"
echo "════════════════════════════════════════════════════════════════════"
