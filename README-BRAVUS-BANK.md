# 🚀 BRAVUS BANK - Sistema Bancário Digital Completo

## 📋 Descrição

Sistema bancário digital completo com autenticação JWT, gerenciamento de usuários, transações financeiras e painel administrativo.

## 🏗️ Arquitetura

### Backend
- **Framework**: Spring Boot 3.3.4
- **Linguagem**: Java 17+
- **Banco de Dados**: PostgreSQL 15
- **Segurança**: Spring Security + JWT
- **Migrações**: Flyway
- **API**: REST

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Roteamento**: React Router v6
- **HTTP Client**: Axios
- **Estilo**: CSS Moderno (Cyber Theme)

## 🎯 Funcionalidades

### 👤 Área de Usuário
- ✅ Login e Cadastro com JWT
- ✅ Dashboard com saldo e informações da conta
- ✅ Depósitos
- ✅ Saques
- ✅ Transferências entre contas
- ✅ Histórico completo de transações
- ✅ Perfil do usuário

### 👑 Área Administrativa
- ✅ Dashboard com estatísticas gerais
- ✅ Gerenciamento de usuários (ativar/desativar/excluir)
- ✅ Visualização de todas as transações
- ✅ Estatísticas financeiras
- ✅ Controle total do sistema

### 🔒 Segurança
- ✅ Autenticação JWT com expiração
- ✅ Senhas criptografadas com BCrypt
- ✅ Controle de acesso por roles (ADMIN/USER)
- ✅ Rotas protegidas no backend e frontend
- ✅ CORS configurado

## 🚀 Como Executar

### Pré-requisitos
- Java 17 ou superior
- Node.js 16 ou superior
- PostgreSQL 15
- Docker e Docker Compose (opcional)

### Opção 1: Com Docker Compose (Recomendado)

```bash
# 1. Navegar para o diretório do backend
cd /workspace/bravus-bank

# 2. Parar containers antigos (se houver)
docker-compose down

# 3. Limpar build anterior
rm -rf target/

# 4. Build da imagem
docker build --no-cache -t bravus-bank .

# 5. Iniciar containers
docker-compose up -d

# 6. Aguardar inicialização (30 segundos)
sleep 30

# 7. Testar backend
curl http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

```bash
# 8. Em outro terminal, iniciar frontend
cd /workspace/bravus-bank-frontend
npm install
npm run dev
```

### Opção 2: Execução Local (Sem Docker)

#### Backend

```bash
# 1. Configurar PostgreSQL local
# Criar banco de dados: bravus
# Usuário: bravus
# Senha: bravus

# 2. Navegar para o diretório do backend
cd /workspace/bravus-bank

# 3. Compilar o projeto
./mvnw clean package -DskipTests

# 4. Executar a aplicação
java -jar target/bravus-bank-*.jar

# Backend estará em http://localhost:9000
```

#### Frontend

```bash
# 1. Navegar para o diretório do frontend
cd /workspace/bravus-bank-frontend

# 2. Instalar dependências
npm install

# 3. Iniciar servidor de desenvolvimento
npm run dev

# Frontend estará em http://localhost:5173
```

## 🔑 Credenciais de Teste

### Administrador
- **Usuário**: `admin`
- **Senha**: `admin123`
- **Conta**: `0000000001`
- **Acesso**: Dashboard Admin + Dashboard Usuário

### Usuário Regular
- **Usuário**: `user`
- **Senha**: `user123`
- **Conta**: `0000000002`
- **Saldo Inicial**: R$ 1.000,00
- **Acesso**: Dashboard Usuário

## 🌐 Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Cadastro

### Usuário (Autenticado)
- `GET /api/user/profile` - Perfil do usuário
- `GET /api/user/balance` - Saldo
- `GET /api/user/transactions` - Histórico de transações
- `POST /api/user/deposit` - Realizar depósito
- `POST /api/user/withdraw` - Realizar saque
- `POST /api/user/transfer` - Realizar transferência

### Admin (Apenas Administrador)
- `GET /api/admin/dashboard` - Estatísticas do sistema
- `GET /api/admin/users` - Listar todos os usuários
- `GET /api/admin/users/{id}` - Detalhes de um usuário
- `PUT /api/admin/users/{id}/activate` - Ativar usuário
- `PUT /api/admin/users/{id}/deactivate` - Desativar usuário
- `DELETE /api/admin/users/{id}` - Excluir usuário
- `GET /api/admin/transactions` - Todas as transações

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

#### users
- id, username, email, password (bcrypt)
- full_name, cpf, phone
- account_number, account_type, balance
- is_active, created_at, updated_at

#### roles
- id, name, description

#### user_roles
- user_id, role_id

#### transactions
- id, user_id, type, amount
- description, destination_account
- status, created_at

#### customers (Stripe)
- id, stripe_customer_id, name, email
- type (PF/PJ), document, phone

#### payments (Stripe)
- id, stripe_payment_intent_id
- customer_id, gross_amount, fee_amount
- currency, description, status

#### transfers (Stripe)
- id, stripe_transfer_id
- destination_account_id
- gross_amount, fee_amount, net_amount

## 🎨 Interface do Usuário

### Tema Cyber
- Gradientes neon (verde/azul)
- Fundo escuro (dark mode)
- Animações suaves
- Design responsivo
- Cards com glassmorphism

### Páginas
1. **Home** - Landing page com features
2. **Login** - Autenticação de usuários
3. **Cadastro** - Registro de novos usuários
4. **Dashboard Usuário** - Painel do cliente
5. **Dashboard Admin** - Painel administrativo

## 🔧 Configuração

### Backend (application.yml)
```yaml
server:
  port: 9000

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/bravus
    username: bravus
    password: bravus
```

### Frontend (src/services/api.js)
```javascript
const API_URL = 'http://localhost:9000/api';
```

## 🧪 Testes

### Testar Login (Backend)
```bash
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Testar Perfil (Com Token)
```bash
TOKEN="seu_token_aqui"
curl -X GET http://localhost:9000/api/user/profile \
  -H "Authorization: Bearer $TOKEN"
```

### Testar Frontend
1. Abrir http://localhost:5173
2. Fazer login com credenciais de teste
3. Navegar pelas funcionalidades

## 📦 Build para Produção

### Backend
```bash
cd /workspace/bravus-bank
./mvnw clean package -DskipTests
java -jar target/bravus-bank-*.jar
```

### Frontend
```bash
cd /workspace/bravus-bank-frontend
npm run build
# Arquivos em dist/ prontos para deploy
```

## 🐛 Troubleshooting

### Backend não inicia
- Verificar se PostgreSQL está rodando
- Verificar credenciais do banco
- Verificar porta 9000 disponível

### Frontend não conecta
- Verificar se backend está rodando
- Verificar URL da API em `src/services/api.js`
- Verificar CORS no backend

### Erro de autenticação
- Verificar se o token está sendo enviado
- Verificar se o token não expirou (24h)
- Limpar localStorage e fazer login novamente

## 📝 Licença

Este projeto é de código aberto para fins educacionais.

## 👨‍💻 Desenvolvido por

**Bravus Bank Development Team**
- Backend: Spring Boot + PostgreSQL + JWT
- Frontend: React + Vite + Modern CSS
- Security: BCrypt + JWT + Spring Security

---

## 🎯 Status do Projeto

✅ Backend completo com autenticação JWT
✅ Frontend React completo e responsivo
✅ Sistema de usuários e transações
✅ Painel administrativo funcional
✅ Segurança implementada (roles e JWT)
✅ Banco de dados com migrations
✅ API REST documentada
✅ Interface moderna e profissional

**Sistema 100% funcional e pronto para uso!** 🚀
