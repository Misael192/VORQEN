#!/usr/bin/env node
/**
 * Workaround para pnpm + Prisma 6.x:
 * `prisma generate` grava o cliente em <root>/node_modules/.prisma/client,
 * mas o @prisma/client resolvido via store (.pnpm) continua com o stub
 * ("did not initialize yet"). Este script sincroniza o código gerado para
 * dentro do pacote no store, garantindo que a aplicação carregue o cliente.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const generated = path.join(root, 'node_modules', '.prisma', 'client');
const storeDir = path.join(root, 'node_modules', '.pnpm');

if (!fs.existsSync(generated)) {
  console.error('[fix-prisma-client] Cliente gerado não encontrado em', generated);
  process.exit(1);
}

const pkgJson = JSON.parse(
  fs.readFileSync(path.join(root, 'node_modules', '@prisma', 'client', 'package.json'), 'utf8')
);

// Localiza o diretório do @prisma/client dentro do store .pnpm
let target = null;
for (const entry of fs.readdirSync(storeDir)) {
  if (!entry.startsWith('@prisma+client@')) continue;
  const physClient = path.join(storeDir, entry, 'node_modules', '@prisma', 'client');
  const clientPkg = path.join(physClient, 'package.json');
  // realpath resolve tanto entradas diretas quanto links do store do pnpm
  const realPkg = path.join(fs.realpathSync(path.dirname(clientPkg)), 'package.json');
  if (fs.existsSync(realPkg)) {
    const pj = JSON.parse(fs.readFileSync(realPkg, 'utf8'));
    if (pj.version === pkgJson.version) {
      target = path.join(path.dirname(realPkg), '..', '.prisma', 'client');
      break;
    }
  }
}

if (!target || !fs.existsSync(path.dirname(target))) {
  console.warn('[fix-prisma-client] Diretório alvo no store .pnpm não encontrado; pulando.');
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
for (const file of fs.readdirSync(generated)) {
  const src = path.join(generated, file);
  const dst = path.join(target, file);
  if (fs.statSync(src).isDirectory()) continue;
  fs.copyFileSync(src, dst);
}

// default.js gerado usa import map '#main-entry-point' indisponível fora do
// contexto do pacote; substituímos por um re-export direto de index.js.
fs.writeFileSync(
  path.join(target, 'default.js'),
  'module.exports = {\n  ...require("./index.js"),\n}\n'
);
fs.writeFileSync(path.join(target, 'default.d.ts'), 'export * from "./index.js"\n');

console.log('[fix-prisma-client] Cliente sincronizado para', target);
