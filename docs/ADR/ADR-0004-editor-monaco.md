# ADR-0004 — Editor: textarea → Monaco (Fase 8)

Data: 2026-10-31 · Status: PROPOSTO (gate: autorização de dependência antes de qualquer pnpm add)

## Evidência atual
Editor existente é `<textarea>` — literal: `apps/web/src/components/IDEWorkspace.tsx:120: <textarea` (branch ci/cd, checkout desta sessão). Zero ocorrências de monaco em todas as branches.

## Decisão proposta
Na Fase 8, substituir por Monaco Editor (`@monaco-editor/react` ou loader oficial), lendo/salvando arquivos via API (ProjectFile já existe), com árvore de arquivos, abas, diff e estados de erro. O textarea atual permanece até o Monaco estar funcional (R10 — não destruir o que funciona antes da substituição validada).

## Riscos
- Bundle size / worker config em Next App Router (SSR precisa de dynamic import).
- Adição de dependência = ação gated por R3: pedir autorização com versões exatas antes de instalar.
