export type FilesMap = Record<string, string>;

export const DEFAULT_MODEL = 'llama3.1';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

const KEY_BASE_URL = 'vorqen_ollama_base_url';
const KEY_MODEL = 'vorqen_ollama_model';

export function getOllamaSettings(): { baseUrl: string; model: string } {
  if (typeof window === 'undefined') {
    return { baseUrl: DEFAULT_OLLAMA_URL, model: DEFAULT_MODEL };
  }
  return {
    baseUrl: window.localStorage.getItem(KEY_BASE_URL) ?? DEFAULT_OLLAMA_URL,
    model: window.localStorage.getItem(KEY_MODEL) ?? DEFAULT_MODEL,
  };
}

export function saveOllamaSettings(baseUrl: string, model: string): void {
  window.localStorage.setItem(KEY_BASE_URL, baseUrl.trim());
  window.localStorage.setItem(KEY_MODEL, model.trim());
}

const BUILD_JSON = JSON.stringify(
  {
    name: 'vorqen-app',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite --port 3010' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.1',
      vite: '^5.4.0',
      typescript: '^5.4.5',
    },
  },
  null,
  2,
);

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3010 },
});
`;

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
      allowJs: true,
      noEmit: true,
    },
    include: ['src'],
  },
  null,
  2,
);

const INDEX_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VORQEN App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

const APP_TSX = `export default function App() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 32 }}>
      <h1>Hello, VORQEN!</h1>
      <p>Edite este arquivo ou descreva no chat o que voce quer construir.</p>
    </main>
  );
}
`;

export function defaultScaffold(): FilesMap {
  return {
    'index.html': INDEX_HTML,
    'package.json': BUILD_JSON,
    'vite.config.js': VITE_CONFIG,
    'tsconfig.json': TSCONFIG,
    'src/main.tsx': MAIN_TSX,
    'src/App.tsx': APP_TSX,
  };
}

const FILE_PREFIX = 'VORQEN_FILE: ';
const END_MARKER = 'VORQEN_END_OF_FILES';

/**
 * Extrai arquivos do texto bruto vindo do stream.
 * Suporta dois formatos:
 *  1. JSON estrito {"files":[{"path","content"}]} (schema do OllamaProvider)
 *  2. Formato textual "VORQEN_FILE: <path>" ... "VORQEN_END_OF_FILES"
 */
export function extractFiles(raw: string): FilesMap | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Formato JSON
  try {
    const parsed = JSON.parse(trimmed) as { files?: unknown };
    if (Array.isArray(parsed.files)) {
      const result: FilesMap = {};
      for (const item of parsed.files) {
        const file = item as { path?: unknown; content?: unknown };
        if (typeof file.path === 'string' && typeof file.content === 'string') {
          result[sanitizePath(file.path)] = file.content;
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    }
  } catch {
    // tenta o formato textual abaixo
  }

  // Formato textual por blocos
  const blocks = trimmed.split(FILE_PREFIX).slice(1);
  if (blocks.length === 0) return null;
  const result: FilesMap = {};
  for (const block of blocks) {
    const newlineIdx = block.indexOf('\n');
    if (newlineIdx === -1) continue;
    const path = sanitizePath(block.slice(0, newlineIdx).trim());
    let content = block.slice(newlineIdx + 1);
    const endIdx = content.indexOf(END_MARKER);
    if (endIdx !== -1) content = content.slice(0, endIdx);
    if (path) result[path] = content.replace(/^\n/, '').replace(/\n$/, '\n');
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function sanitizePath(path: string): string {
  const clean = path
    .trim()
    .replace(/^\/+/, '')
    .replace(/\\/g, '/');
  const parts = clean.split('/').filter((p) => p && p !== '.' && p !== '..');
  return parts.join('/');
}

export const SYSTEM_PROMPT_TEXTUAL = `Voce e o VORQEN, um assistente de programacao. Responda APENAS com blocos de arquivos completos usando exatamente este formato, sem markdown e sem texto extra:

VORQEN_FILE: caminho/relativo/arquivo.ext
<conteudo completo do arquivo>
VORQEN_END_OF_FILES

Para cada arquivo, use um bloco separado. Caminhos devem ser relativos (ex.: src/App.tsx). Se o app usa React, inclua sempre package.json, index.html, src/main.tsx e src/App.tsx.`;
