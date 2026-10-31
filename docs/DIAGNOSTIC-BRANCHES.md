# Diagnóstico das branches da Fase A

## Escopo e método

As refs foram atualizadas com `git fetch --all --prune`. A worktree ativa estava na branch `misael192-issue-fix` e já continha alterações locais em `apps/api/package.json`, `apps/web/postcss.config.js` e `package.json`. Para não sobrescrever essas alterações nem afetar o servidor em execução, cada branch foi montada em uma worktree temporária detached, em vez de trocar a branch da worktree ativa. Os comandos executados foram `npx pnpm install`, `npx pnpm -r run build` e `npx pnpm -r run test`. As worktrees temporárias foram removidas após a coleta; as alterações locais preexistentes foram preservadas.

Logs completos de instalação, build e testes ficaram em `%TEMP%`:

| Branch | Logs |
|---|---|
| `ci/cd-authentication-audit-5d2e3` | `install-ci-cd-auth.log`, `build-ci-cd-auth.log`, `test-ci-cd-auth.log` |
| `vorqen-editor-mvp-d03f4` | `install-editor-mvp.log`, `build-editor-mvp.log`, `test-editor-mvp.log` |
| `vorqen-mvp-architecture-56c9d` | `install-mvp-architecture.log`, `build-mvp-architecture.log`, `test-mvp-architecture.log` |

## Inventário de refs e commits

Saída literal de `git fetch --all --prune; git branch -a; git log --oneline -5`:

```text
From https://github.com/Misael192/VORQEN
   1d20c87..5a917c1  vorqen-studio-identity-d0476 -> origin/vorqen-studio-identity-d0476
+ main
* misael192-issue-fix
  remotes/origin/HEAD -> origin/main
  remotes/origin/ai-platform-similar-to-lovable-c458b
  remotes/origin/ci/cd-authentication-audit-5d2e3
  remotes/origin/feat/fase-1-ai-core
  remotes/origin/main
  remotes/origin/vorqen-editor-mvp-d03f4
  remotes/origin/vorqen-mvp-architecture-56c9d
  remotes/origin/vorqen-studio-identity-d0476
944e1ba feat(ai-core): adicionar pacote reutilizável Ollama
9ff7e0a feat(ai-core): fase 1 - recon, arquitetura, tokens e OllamaProvider
8a33be9 Initialize project database schema and configure monorepo dependencies
4f7f560 Initialize monorepo structure with NestJS API and Next.js Web app dependencies - Add pnpm-lock.yaml for unified dependency management across apps/api and apps/web - Update apps/api/package.json to pin Prisma 6.19.3 and add PRISMA_GENERATE_SKIP_AUTOINSTALL flag - Configure prisma/schema.prisma with explicit client output path for better build isolation
060e033 fix: align phase 0 with prompt master constraints and remove early-future tables/secret
```

## Instalação, build e testes

| Branch | Install | Build | Testes | Arquivos-chave presentes |
|---|---|---|---|---|
| `ci/cd-authentication-audit-5d2e3` | OK (exit 0) | **OK** (exit 0) | **9/9**; 2 suites passaram (4 ai-core + 5 API) | `apps/api/src/auth/` (JWT), `apps/api/src/projects/`, `apps/web/src/components/IDEWorkspace.tsx`, `ChatPanel.tsx`, `apps/web/src/lib/ai/OllamaProvider.ts`, implementação `packages/ai-core/src/providers/OllamaProvider.ts` e `ollama.spec.ts` |
| `vorqen-editor-mvp-d03f4` | OK (exit 0) | **Falhou** (exit 1; 19 erros TypeScript no API) | **0/2 suites executadas**; as duas falharam na compilação TypeScript antes de rodar casos | Auth e projetos em `apps/api/src/`; `apps/web/app/ide/[projectId]/page.tsx`, login e API client; `apps/web/src/lib/ai/OllamaProvider.ts` existe como superfície da web, mas a implementação do provider em `packages/ai-core` não está presente |
| `vorqen-mvp-architecture-56c9d` | OK (exit 0) | **Falhou** (exit 1 no API, por 4 erros de tipos Prisma); `packages/ai-core` compilou com sucesso | **N/A (0/0)**; não há arquivos de teste nem script `test` nos pacotes; o comando recursivo terminou com exit 0 sem executar testes | `packages/ai-core/src/codegen.ts`, `providers/ollama.ts`, `tsconfig.build.json`; `apps/web/components/chat/ChatPanel.tsx`, `apps/web/src/components/AIConfigForm.tsx`, páginas de settings/providers |

Na branch `editor-mvp`, a compilação do API também reportou falhas relacionadas ao cliente Prisma não gerado, uso inválido de `@MinLength`, referência a `MaxLength` não importada, `useBodyParser` inexistente na tipagem e importação de `supertest` incompatível. Os testes listados no branch não chegaram a executar nenhum caso.

## Afirmações verificadas

### 3a. O editor MVP apaga `OllamaProvider.ts`?

**Confirmado, com escopo:** o comando abaixo mostra que `packages/ai-core/src/providers/OllamaProvider.ts` é removido na branch editor MVP em relação à `main`. Isso não significa que toda referência web ao nome desaparece: `apps/web/src/lib/ai/OllamaProvider.ts` continua listado na branch, mas a implementação do pacote ai-core está ausente.

Comando: `git diff main origin/vorqen-editor-mvp-d03f4 -- '*OllamaProvider*'`

Trecho literal:

```diff
diff --git a/packages/ai-core/src/providers/OllamaProvider.ts b/packages/ai-core/src/providers/OllamaProvider.ts
deleted file mode 100644
index 85673a2..0000000
--- a/packages/ai-core/src/providers/OllamaProvider.ts
+++ /dev/null
@@ -1,132 +0,0 @@
```

### 3b. O ai-core da `main` tem script `build`?

**Refutado.** `git show main:packages/ai-core/package.json` não contém a chave `scripts`; portanto, não há script `build` definido nesse pacote na `main`.

### 3c. O ai-core de `vorqen-mvp-architecture` tem script `build` e é funcional?

**Confirmado.** `git show origin/vorqen-mvp-architecture-56c9d:packages/ai-core/package.json` contém `"build": "tsc -p tsconfig.build.json"`. Na execução de `pnpm -r run build` dessa branch, `packages/ai-core build: Done`; o build do monorepo, contudo, falhou separadamente no API por erros de tipos do cliente Prisma.

## Web na `main`: mock ou lógica real?

Os caminhos especificados na solicitação (`apps/web/src/app/page.tsx` e `apps/web/src/app/layout.tsx`) **não existem** na `main`. A aplicação usa `apps/web/app/page.tsx` e `apps/web/app/layout.tsx`.

Conclusão: **casca estática/mock**, sem `useState`, autenticação ou lógica de aplicação na página principal. Os indicadores “Projects 01”, “Agents AI” e “Status Live” estão hardcoded. Conteúdo literal dos arquivos efetivamente usados:

`apps/web/app/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-12 shadow-2xl shadow-brand-900/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-black text-slate-950">
            V
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Platform</p>
            <h1 className="text-3xl font-bold">VORQEN</h1>
          </div>
        </div>

        <p className="text-lg text-slate-300">
          An AI-native workspace for building, editing, versioning and previewing software projects.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Projects</p>
            <p className="mt-2 text-2xl font-semibold text-brand-300">01</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Agents</p>
            <p className="mt-2 text-2xl font-semibold text-brand-300">AI</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">Live</p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

`apps/web/app/layout.tsx`:

```tsx
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

## Tabelas do Prisma: `main` versus `ci/cd`

Comparação limitada aos nomes dos models/tabelas:

| `main` | `ci/cd-authentication-audit-5d2e3` |
|---|---|
| `User` | `User` |
| `Session` | `Session` |
| `Project` | `Project` |
| `AiConnection` | `AiConnection` |
| `EncryptedCredential` | `EncryptedCredential` |
| `ProjectVersion` | `ProjectVersion` |
| — | `ProjectFile` |
| — | `ChatMessage` |

Assim, a branch `ci/cd` acrescenta `ProjectFile` e `ChatMessage`; os outros seis models listados são comuns às duas versões do schema.
