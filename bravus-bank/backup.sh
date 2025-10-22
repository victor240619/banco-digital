#!/bin/bash
# Bravus Bank Database Backup Script
# This script creates a backup of the PostgreSQL database

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-bravus}
DB_USER=${DB_USER:-bravus}
BACKUP_DIR=${BACKUP_DIR:-./db/backups}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bravus_backup_$TIMESTAMP.dump"

echo "🚀 Starting backup of database '$DB_NAME'..."
echo "📍 Host: $DB_HOST:$DB_PORT"
echo "👤 User: $DB_USER"
echo "📁 Backup file: $BACKUP_FILE"

# Create backup using pg_dump
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -Fc \
    -v \
    -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully!"
    echo "📄 Backup saved to: $BACKUP_FILE"
    
    # Show backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 Backup size: $BACKUP_SIZE"
    
    # Keep only the last 7 backups
    echo "🧹 Cleaning up old backups (keeping last 7)..."
    find "$BACKUP_DIR" -name "bravus_backup_*.dump" -type f -mtime +7 -delete
    
    echo "🎉 Backup process completed!"
else
    echo "❌ Backup failed!"
    exit 1
fi