#!/bin/sh
set -e
mkdir -p /data
# Ensure the SQLite schema exists (idempotent). Schema/client were generated at build.
npx prisma db push --skip-generate --accept-data-loss
# Seed only if the database is empty.
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');(async()=>{const p=new PrismaClient();console.log(await p.site.count());await p.$disconnect();})()" 2>/dev/null || echo "0")
if [ "$COUNT" = "0" ]; then
  echo "Database empty — seeding…"
  npx tsx prisma/seed.ts
else
  echo "Database already seeded ($COUNT sites)."
fi
exec node node_modules/next/dist/bin/next start -p ${PORT:-3000}
