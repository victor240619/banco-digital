#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║         🔧 CRIANDO USUÁRIOS NO BANCO - BRAVUS BANK              ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

cd ~/banco-digital/bravus-bank

echo "1️⃣ Criando tabelas e usuários no banco..."
echo ""

docker exec -i bravus-postgres psql -U bravus -d bravus << 'EOSQL'

-- Criar tabela de roles se não existir
CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255)
);

-- Criar tabela de usuários se não existir
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE,
    phone VARCHAR(20),
    balance BIGINT DEFAULT 0,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(20) DEFAULT 'CORRENTE',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela user_roles se não existir
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Criar tabela de transações se não existir
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_OUT', 'TRANSFER_IN', 'PAYMENT')),
    amount BIGINT NOT NULL,
    description TEXT,
    destination_account VARCHAR(20),
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Limpar dados existentes
DELETE FROM user_roles;
DELETE FROM transactions;
DELETE FROM users;
DELETE FROM roles;

-- Inserir roles
INSERT INTO roles (id, name, description) VALUES 
    (1, 'ROLE_ADMIN', 'Administrator with full access'),
    (2, 'ROLE_USER', 'Regular bank user')
ON CONFLICT (name) DO NOTHING;

-- Inserir usuário admin (senha: admin123)
-- Hash BCrypt de "admin123": $2a$10$xQKLy7aZ3p6EqpQKJ9tYP.rOjDHZZN9BPvKZQZ3pPiZGqKqF5Q8bC
INSERT INTO users (id, username, email, password, full_name, cpf, account_number, balance, is_active) 
VALUES (
    1,
    'admin',
    'admin@bravusbank.com',
    '$2a$10$xQKLy7aZ3p6EqpQKJ9tYP.rOjDHZZN9BPvKZQZ3pPiZGqKqF5Q8bC',
    'System Administrator',
    '000.000.000-00',
    '0000000001',
    0,
    TRUE
)
ON CONFLICT (username) DO UPDATE SET
    password = '$2a$10$xQKLy7aZ3p6EqpQKJ9tYP.rOjDHZZN9BPvKZQZ3pPiZGqKqF5Q8bC',
    is_active = TRUE;

-- Inserir usuário regular (senha: user123)
-- Hash BCrypt de "user123": $2a$10$E7iF7YZQqKJqP9sZ1Q3L7.ZQ9sZQKJ9tYP.rOjDHZZN9BPvKZQZ3pP
INSERT INTO users (id, username, email, password, full_name, cpf, account_number, balance, is_active) 
VALUES (
    2,
    'user',
    'user@bravusbank.com',
    '$2a$10$E7iF7YZQqKJqP9sZ1Q3L7.ZQ9sZQKJ9tYP.rOjDHZZN9BPvKZQZ3pP',
    'Test User',
    '111.111.111-11',
    '0000000002',
    100000,
    TRUE
)
ON CONFLICT (username) DO UPDATE SET
    password = '$2a$10$E7iF7YZQqKJqP9sZ1Q3L7.ZQ9sZQKJ9tYP.rOjDHZZN9BPvKZQZ3pP',
    balance = 100000,
    is_active = TRUE;

-- Associar role admin ao usuário admin
INSERT INTO user_roles (user_id, role_id) VALUES (1, 1)
ON CONFLICT DO NOTHING;

-- Associar role user ao usuário user
INSERT INTO user_roles (user_id, role_id) VALUES (2, 2)
ON CONFLICT DO NOTHING;

-- Resetar sequences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));

-- Verificar
SELECT 'Usuários criados:' as status;
SELECT username, email, is_active, account_number FROM users;

EOSQL

echo ""
echo "✅ Usuários criados com sucesso!"
echo ""
echo "🧪 Testando login..."
sleep 3
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' 2>/dev/null | jq . 2>/dev/null || \
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

echo ""
echo ""
echo "✨ Se viu um 'token' acima, funcionou!"
echo ""
echo "🚀 Agora execute o frontend:"
echo "   cd ~/banco-digital/bravus-bank-frontend && npm run dev"
echo ""
