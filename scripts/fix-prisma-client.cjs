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

// Localiza o diretório do @prisma/client dentro do store .pnpm.
// Estratégia: para cada entrada @prisma+client@* do store, o cliente resolvido
// fica em <store>/<entry>/node_modules/@prisma/client e o ".prisma/client"
// correspondente fica em <store>/<entry>/node_modules/.prisma/client.
// Valida a versão lendo o package.json via caminho físico (realpath do link).
let target = null;
for (const entry of fs.readdirSync(storeDir)) {
  if (!entry.startsWith('@prisma+client@')) continue;
  const nmDir = path.join(storeDir, entry, 'node_modules');
  const clientLink = path.join(nmDir, '@prisma', 'client');
  if (!fs.existsSync(clientLink)) continue;
  const realClientDir = fs.realpathSync(clientLink);
  const realPkg = path.join(realClientDir, 'package.json');
  if (!fs.existsSync(realPkg)) continue;
  const pj = JSON.parse(fs.readFileSync(realPkg, 'utf8'));
  if (pj.version === pkgJson.version) {
    target = path.join(nmDir, '.prisma', 'client');
    break;
  }
}

if (!target || !fs.existsSync(path.dirname(target))) {
  console.warn('[fix-prisma-client] Diretório alvo no store .pnpm não encontrado; pulando.');
  process.exit(0);
}

fs.mkdirSync(target, { recursive: true });
// Copia recursivamente: o cliente gerado pelo Prisma 6.x possui subdiretórios
// obrigatórios (ex.: runtime/ com library.js e os engines .so.node). Copiar
// apenas arquivos soltos quebra o require('./runtime/library.js') do index.js.
function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dst, child));
    }
  } else if (stat.isSymbolicLink()) {
    // Links simbólicos não são necessários entre camadas do store; copiamos o conteúdo.
    fs.copyFileSync(fs.realpathSync(src), dst);
  } else {
    fs.copyFileSync(src, dst);
  }
}
for (const file of fs.readdirSync(generated)) {
  copyRecursive(path.join(generated, file), path.join(target, file));
}

// default.js gerado usa import map '#main-entry-point' indisponível fora do
// contexto do pacote; substituímos por um re-export direto de index.js.
fs.writeFileSync(
  path.join(target, 'default.js'),
  'module.exports = {\n  ...require("./index.js"),\n}\n'
);
fs.writeFileSync(path.join(target, 'default.d.ts'), 'export * from "./index.js"\n');

console.log('[fix-prisma-client] Cliente sincronizado para', target);
