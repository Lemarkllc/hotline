#!/bin/sh
set -e
echo "Применяю миграции Prisma..."
./node_modules/.bin/prisma migrate deploy
exec "$@"
