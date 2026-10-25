#!/usr/bin/env bash
# Bootstrap do banco de dados local para ambientes SEM Docker (ex.: sandbox).
# Equivalente local ao serviço postgres do docker-compose.yml.
# Uso: bash scripts/setup-local-db.sh
set -euo pipefail

DB_USER="plataforma"
DB_PASS="plataforma"
DB_NAME="plataforma"

if ! command -v pg_isready >/dev/null 2>&1; then
  echo "[setup-db] PostgreSQL não encontrado. Instalando..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

echo "[setup-db] Iniciando serviço PostgreSQL..."
(service postgresql start 2>/dev/null || pg_ctlcluster 15 main start) && sleep 2

if ! PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
  echo "[setup-db] Criando usuário e database '$DB_NAME'..."
  su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 || psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;\""
  su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
fi

PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" | head -3
echo "[setup-db] OK — DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?schema=public"
