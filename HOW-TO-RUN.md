# Como rodar o Bravus Bank em desenvolvimento

Guia rapido para subir backend e frontend localmente sem perder dados.

## Pre-requisitos

- Docker com Docker Compose v2 (`docker compose version`)
- Node.js 18+ e npm
- Git

## Backend: API Spring Boot + Postgres

```bash
cd bravus-bank
chmod +x dev-up.sh
./dev-up.sh
```

O script:

1. Cria `.env` automaticamente a partir do `.env.example`, se nao existir.
2. Gera um `JWT_SECRET` forte aleatorio.
3. Sobe DB + API com Docker Compose.
4. Aguarda o health-check e mostra as URLs.

Para parar sem perder dados:

```bash
docker compose down
```

Atencao: `docker compose down -v` apaga o volume do Postgres e remove usuarios, saldos e transacoes locais. Use somente quando a intencao for resetar tudo, depois de backup.

## URLs

| Servico | URL |
|---|---|
| API | http://localhost:9000 |
| Health | http://localhost:9000/actuator/health |
| Postgres | `localhost:5432` (db: `bravus` / user: `bravus` / pass: `bravus`) |

## Usuarios de teste via migration

| Usuario | Senha | Role |
|---|---|---|
| `admin` | `admin123` | `ROLE_ADMIN` |
| `user` | `user123` | `ROLE_USER` |

## Frontend: React + Vite + Tailwind

```bash
cd bravus-bank-frontend
npm install
cp .env.example .env
npm run dev
```

Abre em http://localhost:5173.

## Troubleshooting

`JWT_SECRET nao definido`: rode `./dev-up.sh` ou edite `.env`.

`port 5432 already allocated`: ja existe um Postgres local nessa porta. Pare-o ou mude a porta no `docker-compose.yml`.

`Invalid username or password`: confira `docker compose logs db` e `docker compose logs bravus-bank`. Nao use `docker compose down -v` como primeira correcao, porque isso apaga o banco local. Restaure um backup ou rode uma migracao corretiva quando houver dados reais.

Erro de CORS no frontend: confira `CORS_ORIGIN` no `.env` do backend.

API nao sobe (`Connection refused`): veja `docker compose logs bravus-bank -f`.

Causas comuns:

- Postgres ainda nao esta healthy.
- Falta `JWT_SECRET`.
- Conflito de porta 9000.

## Teste rapido da API

```bash
curl http://localhost:9000/actuator/health

curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Voce deve receber um JSON com `token`, `username` e `roles`.
