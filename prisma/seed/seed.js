/* Seed idempotente do banco de desenvolvimento.
 * Cria o usuario demo@vorqen.dev / vorqen123456 e um projeto inicial.
 * Uso: node prisma/seed/seed.js (com DATABASE_URL apontando para o Postgres).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const EMAIL = 'demo@vorqen.dev';
const PASSWORD = 'vorqen123456';

async function main() {
  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, passwordHash },
  });

  const existingProject = await prisma.project.findFirst({ where: { ownerId: user.id } });
  if (!existingProject) {
    const project = await prisma.project.create({
      data: { ownerId: user.id, name: 'Novo App' },
    });
    await prisma.projectVersion.create({
      data: {
        projectId: project.id,
        snapshotJson: {
          files: [
            {
              path: 'index.html',
              content:
                '<!doctype html>\n<html lang="pt-BR">\n  <head>\n    <meta charset="UTF-8" />\n    <title>VORQEN App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
            },
            {
              path: 'src/App.tsx',
              content:
                'export default function App() {\n  return <h1>Hello, VORQEN!</h1>;\n}\n',
            },
          ],
        },
      },
    });
  }

  console.log(`Seed ok: usuario ${EMAIL} criado/reaproveitado (id=${user.id}).`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
