#!/bin/bash
# Script de backup simples do PostgreSQL
set -euo pipefail
DB_URL=${DB_URL:-jdbc:postgresql://localhost:5432/bravus}
echo "Iniciando backup do banco de dados para $(echo "$DB_URL" | awk -F'[/:]' '{print $(NF)}')..."
mkdir -p db
pg_dump -Fc -d "$DB_URL" > db/backup-$(date +%Y%m%d_%H%M%S).dump
echo "Backup concluído."
