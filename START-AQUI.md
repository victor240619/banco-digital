# 🎯 START AQUI - GUIA RÁPIDO BRAVUS BANK

## ⚡ INÍCIO RÁPIDO (3 Minutos)

### Opção 1: Com Docker (Recomendado)

```bash
# 1. Backend (Spring Boot + PostgreSQL)
cd ~/banco-digital/bravus-bank
docker-compose down
rm -rf target/
docker build --no-cache --network=host -t bravus-bank .
docker-compose up -d
sleep 30

# 2. Frontend (React + Vite) - EM OUTRO TERMINAL
cd /workspace/bravus-bank-frontend
npm install
npm run dev

# 3. Abrir navegador
# http://localhost:5173

# 4. Login
# Usuário: admin
# Senha: admin123
```

### Opção 2: Sem Docker

```bash
# 1. Configurar PostgreSQL local
# - Banco: bravus
# - Usuário: bravus
# - Senha: bravus

# 2. Backend
cd /workspace/bravus-bank
./mvnw clean package -DskipTests
java -jar target/bravus-bank-*.jar

# 3. Frontend - EM OUTRO TERMINAL
cd /workspace/bravus-bank-frontend
npm install
npm run dev

# 4. Abrir navegador
# http://localhost:5173
```

## 🔑 CREDENCIAIS

### Admin
- Usuário: `admin`
- Senha: `admin123`
- Acesso: Admin Dashboard + User Dashboard

### User
- Usuário: `user`
- Senha: `user123`
- Acesso: User Dashboard

## 🌐 URLs

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:9000
- **API Docs**: Ver endpoints no README-BRAVUS-BANK.md

## 🧪 TESTAR

1. Login com `admin` / `admin123`
2. Ir para "Admin Dashboard"
3. Ver estatísticas e gerenciar usuários
4. Voltar para Dashboard normal
5. Fazer um depósito de R$ 100,00
6. Fazer uma transferência para conta `0000000002`
7. Ver histórico de transações
8. Logout
9. Login com `user` / `user123`
10. Verificar saldo e transações

## 📚 DOCUMENTAÇÃO

- **README-BRAVUS-BANK.md** - Documentação completa
- **INSTRUCOES-DEPLOY.md** - Guia de deploy detalhado
- **RESUMO-EXECUTIVO.md** - Visão geral do projeto

## ✅ CHECKLIST

- [ ] Backend rodando (http://localhost:9000)
- [ ] Frontend rodando (http://localhost:5173)
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Transações funcionando

## 🆘 PROBLEMAS?

### Backend não inicia
```bash
docker-compose logs bravus-bank
```

### Frontend não conecta
Verificar se backend está em http://localhost:9000

### Erro de autenticação
Limpar localStorage do navegador:
```javascript
localStorage.clear();
```

## 🚀 PRONTO!

**Sistema 100% funcional. Boa exploração!** 🎉
