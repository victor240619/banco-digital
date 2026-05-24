# 🚀 Como rodar o Bravus Bank (dev)

Guia rápido pra subir o sistema completo (backend + frontend) localmente.

---

## ✅ Pré-requisitos

- **Docker** + **Docker Compose v2** (`docker compose version`)
- **Node.js 18+** e **npm** (pro frontend)
- **Git**

---

## 🐳 Backend (API Spring Boot + Postgres)

```bash
cd bravus-bank
chmod +x dev-up.sh
./dev-up.sh
```

O script:

1. Cria `.env` automaticamente a partir do `.env.example` (se não existir).
2. Gera um `JWT_SECRET` forte aleatório.
3. Sobe DB + API com Docker Compose.
4. Aguarda o health-check e mostra as URLs.

**Para parar:** `docker compose down`
**Para resetar o banco:** `docker compose down -v` (apaga o volume)

### URLs

| Serviço | URL |
|---|---|
| API | http://localhost:9000 |
| Health | http://localhost:9000/actuator/health |
| Postgres | `localhost:5432` (db: `bravus` / user: `bravus` / pass: `bravus`) |

### 👤 Usuários de teste (criados via migration)

| Usuário | Senha | Role |
|---|---|---|
| `admin` | `admin123` | `ROLE_ADMIN` |
| `user`  | `user123`  | `ROLE_USER` |

---

## 💻 Frontend (React + Vite + Tailwind)

```bash
cd bravus-bank-frontend
npm install
cp .env.example .env   # (opcional) ajusta VITE_API_URL se a API não for localhost:9000
npm run dev
```

Abre em → http://localhost:5173

---

## 🔥 Troubleshooting

**`JWT_SECRET nao definido`** → rode `./dev-up.sh` (gera automaticamente) ou edite `.env`.

**`port 5432 already allocated`** → você já tem um Postgres rodando local. Pare-o ou mude a porta no `docker-compose.yml`.

**Login falha com `Invalid username or password`** → migração V4 não rodou. Confira `docker compose logs db` e `docker compose logs bravus-bank`. Pra forçar reset: `docker compose down -v && ./dev-up.sh`.

**Erro de CORS no frontend** → confira `CORS_ORIGIN` no `.env` do backend. Se rodar o front em outra porta, ajuste.

**API não sobe (`Connection refused`)** → veja `docker compose logs bravus-bank -f`. Causas comuns:
- Postgres ainda não healthy (espere 30s)
- Falta `JWT_SECRET`
- Conflito de porta 9000

---

## 🧪 Teste rápido da API

```bash
# Health
curl http://localhost:9000/actuator/health

# Login
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Você deve receber um JSON com `token`, `username`, `roles`, etc.
