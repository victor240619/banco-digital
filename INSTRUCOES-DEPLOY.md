# 🚀 INSTRUÇÕES DE DEPLOY - BRAVUS BANK

## ⚡ Deploy Rápido (Docker Compose)

### 1️⃣ Iniciar Backend (Spring Boot + PostgreSQL)

```bash
cd ~/banco-digital/bravus-bank

# Parar containers antigos
docker-compose down

# Limpar build
rm -rf target/

# Build da imagem
docker build --no-cache --network=host -t bravus-bank .

# Iniciar containers
docker-compose up -d

# Aguardar 30 segundos para inicialização
sleep 30

# Testar backend
curl http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2️⃣ Iniciar Frontend (React + Vite)

```bash
# Em outro terminal
cd /workspace/bravus-bank-frontend

# Instalar dependências (primeira vez)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### 3️⃣ Acessar o Sistema

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:9000

### 4️⃣ Fazer Login

**Admin**
- Usuário: `admin`
- Senha: `admin123`

**Usuário Regular**
- Usuário: `user`
- Senha: `user123`

---

## 🐳 Comandos Docker Úteis

```bash
# Ver logs do backend
docker-compose logs -f bravus-bank

# Ver logs do banco de dados
docker-compose logs -f db

# Parar todos os containers
docker-compose down

# Parar e remover volumes (reset completo)
docker-compose down  # preserva volumes; use -v somente apos backup e reset intencional

# Verificar status dos containers
docker-compose ps

# Entrar no container do backend
docker exec -it bravus-bank-app bash

# Entrar no PostgreSQL
docker exec -it bravus-postgres psql -U bravus -d bravus
```

---

## 🔄 Script Automatizado

Copie este código para um arquivo `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Iniciando deploy do Bravus Bank..."

# Backend
cd ~/banco-digital/bravus-bank
docker-compose down
rm -rf target/
docker build --no-cache --network=host -t bravus-bank .
docker-compose up -d

echo "⏳ Aguardando backend inicializar..."
sleep 30

# Frontend
cd /workspace/bravus-bank-frontend
npm install --silent 2>/dev/null || npm install

echo "✅ Deploy concluído!"
echo "🌐 Frontend: npm run dev (porta 5173)"
echo "🌐 Backend: http://localhost:9000"
echo "👤 Login: admin / admin123"
```

Execute:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📝 Verificação Pós-Deploy

### Testar Backend

```bash
# 1. Health check simples
curl http://localhost:9000/api/auth/login

# 2. Login Admin
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq .

# 3. Login User
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"user123"}' \
  | jq .
```

### Testar Frontend

1. Abrir http://localhost:5173
2. Clicar em "Entrar"
3. Usar credenciais: `admin` / `admin123`
4. Verificar se dashboard carrega
5. Testar funcionalidades:
   - Ver saldo
   - Ver transações
   - Fazer depósito
   - Fazer transferência

---

## 🎯 Fluxo de Teste Completo

### Como Administrador (`admin` / `admin123`)

1. Login
2. Ir para "Admin Dashboard"
3. Ver estatísticas do sistema
4. Ver lista de usuários
5. Ativar/desativar usuários
6. Ver todas as transações
7. Voltar para Dashboard normal
8. Fazer um depósito
9. Fazer logout

### Como Usuário (`user` / `user123`)

1. Login
2. Ver saldo (R$ 1.000,00 inicial)
3. Fazer um depósito
4. Fazer um saque
5. Fazer uma transferência para conta `0000000001` (admin)
6. Ver histórico de transações
7. Fazer logout

---

## 🛠️ Troubleshooting

### Problema: Backend não inicia

**Solução:**
```bash
# Ver logs
docker-compose logs bravus-bank

# Verificar se PostgreSQL está rodando
docker-compose ps

# Reiniciar do zero
docker-compose down  # preserva volumes; use -v somente apos backup e reset intencional
docker-compose up -d
```

### Problema: Frontend não conecta no backend

**Solução:**
1. Verificar se backend está rodando: `curl http://localhost:9000`
2. Verificar URL no arquivo `src/services/api.js`
3. Verificar CORS no backend

### Problema: Erro 404 no login

**Solução:**
- Backend ainda está inicializando
- Aguardar mais 10-20 segundos
- Verificar logs: `docker-compose logs bravus-bank`

### Problema: Token inválido

**Solução:**
```javascript
// No navegador (Console)
localStorage.clear();
// Fazer login novamente
```

### Problema: Porta já em uso

**Solução:**
```bash
# Verificar o que está usando a porta
sudo lsof -i :9000
sudo lsof -i :5173

# Matar processo
sudo kill -9 <PID>
```

---

## 🎨 Customização

### Alterar Porta do Backend

Editar `bravus-bank/src/main/resources/application.yml`:
```yaml
server:
  port: 8080  # Trocar para porta desejada
```

E `bravus-bank/docker-compose.yml`:
```yaml
ports:
  - "8080:8080"  # Trocar aqui também
```

### Alterar Porta do Frontend

Editar `bravus-bank-frontend/vite.config.js`:
```javascript
export default defineConfig({
  server: {
    port: 3000  // Trocar para porta desejada
  }
})
```

### Alterar URL da API

Editar `bravus-bank-frontend/src/services/api.js`:
```javascript
const API_URL = 'http://localhost:8080/api';  // Trocar URL
```

---

## ✅ Checklist de Deploy

- [ ] Backend compilado e rodando
- [ ] PostgreSQL inicializado
- [ ] Migrations executadas (Flyway)
- [ ] Usuários de teste criados
- [ ] Frontend instalado (npm install)
- [ ] Frontend rodando (npm run dev)
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Transações funcionando
- [ ] Painel admin acessível

---

## 🚀 Pronto para Produção

### Build de Produção

**Backend:**
```bash
cd bravus-bank
./mvnw clean package -DskipTests
# JAR em target/bravus-bank-*.jar
```

**Frontend:**
```bash
cd bravus-bank-frontend
npm run build
# Arquivos em dist/
```

### Deploy em Servidor

1. Configurar PostgreSQL em produção
2. Configurar variáveis de ambiente
3. Deploy do JAR do backend
4. Deploy dos arquivos do frontend (dist/)
5. Configurar NGINX/Apache
6. Configurar HTTPS

---

**Sistema completo e funcional! Qualquer dúvida, consulte README-BRAVUS-BANK.md** 🎯
