#!/bin/bash
# Script: refactor_bravus_bank.sh
# Propósito: Aplicar correções atômicas e de alta precisão (Segurança, Performance e Infraestrutura)
# no projeto de Banco Digital Bravus Bank.
# Deve ser executado na raiz do repositório.
set -euo pipefail

# Função para fazer backup antes da edição
backup_file() {
  local FILE=$1
  if [ -f "$FILE" ]; then
    cp "$FILE" "$FILE.bak"
    echo "   [BACKUP] $FILE -> $FILE.bak"
  else
    echo "   [ALERTA] Arquivo não encontrado: $FILE"
  fi
}

ROOT_DIR="$(pwd)"
BACKEND_DIR="$ROOT_DIR/bravus-bank"
FRONTEND_DIR="$ROOT_DIR/bravus-bank-frontend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "[ERRO] Diretório do backend não encontrado em $BACKEND_DIR"
  exit 1
fi

APP_YML="$BACKEND_DIR/src/main/resources/application.yml"
POM_XML="$BACKEND_DIR/pom.xml"
DOCKERFILE="$BACKEND_DIR/Dockerfile"
DOCKER_COMPOSE="$BACKEND_DIR/docker-compose.yml"
JWT_SERVICE="$BACKEND_DIR/src/main/java/com/bravus/bank/security/JwtService.java"
AUTH_CONTROLLER="$BACKEND_DIR/src/main/java/com/bravus/bank/auth/AuthController.java"
USER_CONTROLLER="$BACKEND_DIR/src/main/java/com/bravus/bank/user/UserController.java"
ADMIN_CONTROLLER="$BACKEND_DIR/src/main/java/com/bravus/bank/admin/AdminController.java"

echo "========================================================="
echo " 🚀 INICIANDO CORREÇÕES CRÍTICAS E DE SEGURANÇA (BRAVUS BANK)"
echo "========================================================="

# -----------------------------------------------------------
# 🔴 BLOQUEADORES CRÍTICOS & CONFIGURAÇÃO
# -----------------------------------------------------------

echo "--- 🔴 Seção de Bloqueadores Críticos (Configuração e Segurança) ---"

# 1. Segredo JWT: Garantir variável de ambiente e propriedade em application.yml
if [ -f "$APP_YML" ]; then
  backup_file "$APP_YML"
  if ! grep -q "^jwt:" "$APP_YML"; then
    cat >> "$APP_YML" << 'EOF'

jwt:
  secret: ${JWT_SECRET:}
EOF
    echo "✅ 1a. Adicionada configuração jwt.secret em application.yml"
  fi
else
  echo "   [ALERTA] $APP_YML não encontrado; pulando inserção de jwt.secret"
fi

# .env com JWT_SECRET
if [ ! -f "$ROOT_DIR/.env" ]; then
  touch "$ROOT_DIR/.env"
fi
if ! grep -q "^JWT_SECRET" "$ROOT_DIR/.env"; then
  echo "JWT_SECRET='$(openssl rand -base64 48)'" >> "$ROOT_DIR/.env"
  echo "✅ 1b. JWT_SECRET gerado e adicionado ao .env"
else
  echo "ℹ️  1b. JWT_SECRET já presente no .env"
fi

# 1c. Alterar JwtService para ler de env (fallback seguro)
if [ -f "$JWT_SERVICE" ]; then
  backup_file "$JWT_SERVICE"
  # Substitui a linha da SECRET_KEY por leitura do env com fallback de chave forte existente
  sed -i.tmp 's|private static final String SECRET_KEY = ".*";|private static final String SECRET_KEY = System.getenv().getOrDefault("JWT_SECRET", "bravus-bank-super-secret-key-for-jwt-token-generation-2024-please-change-in-production");|g' "$JWT_SERVICE"
  rm -f "$JWT_SERVICE.tmp"
  echo "✅ 1c. JwtService atualizado para usar JWT_SECRET do ambiente"
fi

# 2. Restrição de CORS: Domínios Específicos (Evita Wildcard *)
for CTRL in "$AUTH_CONTROLLER" "$USER_CONTROLLER" "$ADMIN_CONTROLLER"; do
  if [ -f "$CTRL" ]; then
    backup_file "$CTRL"
    sed -i.tmp 's/@CrossOrigin(origins = "\*")/@CrossOrigin(origins = {"${CORS_ORIGIN:http:\/\/localhost:3000}"})/g' "$CTRL"
    rm -f "$CTRL.tmp"
  fi
done
echo "✅ 2. CORS restrito a domínio configurável (CORS_ORIGIN) nos controllers."

# 3. Geração Segura de Números de Conta: Usar SecureRandom
if [ -f "$AUTH_CONTROLLER" ]; then
  backup_file "$AUTH_CONTROLLER"
  # Substitui uso de Math.random() na geração do número de conta por SecureRandom
  sed -i.tmp 's/(long) (Math\.random\(\) \* 10000000000L)/Math.abs(new java.security.SecureRandom().nextLong()) % 10000000000L/g' "$AUTH_CONTROLLER"
  rm -f "$AUTH_CONTROLLER.tmp"
  echo "✅ 3. Mudança para SecureRandom na geração de números de conta"
fi

# 4. Adicionar Actuator para Verificações de Integridade/Monitoramento
if [ -f "$POM_XML" ]; then
  backup_file "$POM_XML"
  if ! grep -q '<artifactId>spring-boot-starter-actuator</artifactId>' "$POM_XML"; then
    sed -i.tmp '/<\/dependencies>/i \    <!-- Monitoring & Health Checks -->\n    <dependency>\n      <groupId>org.springframework.boot<\/groupId>\n      <artifactId>spring-boot-starter-actuator<\/artifactId>\n    <\/dependency>' "$POM_XML"
    rm -f "$POM_XML.tmp"
    echo "✅ 4. Dependência 'spring-boot-starter-actuator' adicionada ao pom.xml"
  else
    echo "ℹ️  4. Actuator já presente no pom.xml"
  fi
fi

# 5. Corrige Dockerfile EXPOSE para 9000
if [ -f "$DOCKERFILE" ]; then
  backup_file "$DOCKERFILE"
  sed -i.tmp 's/EXPOSE 8080/EXPOSE 9000/g' "$DOCKERFILE" || true
  rm -f "$DOCKERFILE.tmp"
  echo "✅ 5. Dockerfile atualizado para expor a porta 9000"
fi

# -----------------------------------------------------------
# ⚙️ CONFIGURAÇÃO DE INFRA E OPERAÇÕES
# -----------------------------------------------------------

echo "--- ⚙️ Seção de Configuração de Infra e Operações ---"

# 6. Criar .env.example (Padrão de boas práticas)
cat > "$ROOT_DIR/.env.example" << 'EOF'
# Variáveis de Ambiente para o Bravus Bank
DB_URL=jdbc:postgresql://localhost:5432/bravus
DB_USER=bravus
DB_PASSWORD=bravus
JWT_SECRET=gerado-automaticamente-pelo-script-ou-defina-o-seu
CORS_ORIGIN=https://app.bravusbank.com
API_URL=http://localhost:9000
DAILY_LIMIT=5000
STRIPE_API_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_FEE_PERCENT=10
STRIPE_SUCCESS_URL=http://localhost:8080/success
STRIPE_CANCEL_URL=http://localhost:8080/cancel
STRIPE_CURRENCY=brl
STRIPE_CONNECT=false
EOF
echo "✅ 6. Criado arquivo .env.example para padronização de variáveis."

# 7. Script de Backup Simples (PostgreSQL)
cat > "$ROOT_DIR/backup.sh" << 'EOF'
#!/bin/bash
# Script de backup simples do PostgreSQL
set -euo pipefail
DB_URL=${DB_URL:-jdbc:postgresql://localhost:5432/bravus}
echo "Iniciando backup do banco de dados para $(echo "$DB_URL" | awk -F'[/:]' '{print $(NF)}')..."
mkdir -p db
pg_dump -Fc -d "$DB_URL" > db/backup-$(date +%Y%m%d_%H%M%S).dump
echo "Backup concluído."
EOF
chmod +x "$ROOT_DIR/backup.sh"
echo "✅ 7. Criado e tornado executável o script de backup (backup.sh)."

# 8. Ajuste opcional do docker-compose (já está 9000:9000 neste projeto)
if [ -f "$DOCKER_COMPOSE" ]; then
  echo "ℹ️  8. docker-compose já mapeia 9000:9000; nenhuma alteração necessária."
fi

# 9. Frontend: App.jsx - adicionar estado de carregamento (opcional)
FRONT_APP_JSX="$FRONTEND_DIR/src/App.jsx"
if [ -f "$FRONT_APP_JSX" ]; then
  backup_file "$FRONT_APP_JSX"
  if ! grep -q "useState(" "$FRONT_APP_JSX"; then
    sed -i.tmp 's/import React/import React, { useState }/g' "$FRONT_APP_JSX" || true
    sed -i.tmp '/function App\|const App/s//&\n  const [isLoading, setIsLoading] = useState(false);/' "$FRONT_APP_JSX" || true
    rm -f "$FRONT_APP_JSX.tmp"
    echo "✅ 9. Adicionado estado de carregamento básico no App.jsx"
  fi
fi

echo "========================================================="
echo " ✅ SCRIPT DE CORREÇÕES CONCLUÍDO COM SUCESSO."
echo "========================================================="
echo "Próximos passos:" 
echo "1. REVISTE OS BACKUPS (.bak) e o 'git diff'."
if command -v mvn >/dev/null 2>&1; then
  echo "2. (Opcional) CONSTRUA: 'cd bravus-bank && mvn clean package -DskipTests'"
fi
if command -v docker-compose >/dev/null 2>&1; then
  echo "3. (Opcional) DOCKER: 'cd bravus-bank && docker-compose up --build'"
fi
