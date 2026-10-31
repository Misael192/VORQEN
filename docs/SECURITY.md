# VORQEN AI Studio — SECURITY

Atualizado: 2026-10-31. Descreve controles existentes (com evidência), planejados e limitações reais. Nenhuma afirmação de segurança sem verificação executada.

## Controles existentes na base escolhida (`ci/cd-authentication-audit-5d2e3`)
- Auth JWT: passport-jwt + bcryptjs (hash de senha); register/login em `apps/api/src/auth/`; 5 testes jest verdes (executados em clone limpo).
- Autorização por ownership nos services de projects/files/chat (verificada por leitura de código; teste formal de 2 usuários ainda não executado contra Postgres real — pendência S-candidata a S1 até comprovação).
- Schema possui `EncryptedCredential` e `AiConnection` (base para BYOK seguro).
- CI yml presente (`.github/workflows/ci.yml`).

## Riscos conhecidos hoje (documentados, não resolvidos)
1. **Chat browser→provider direto** (`ChatPanel.tsx:30` → `http://localhost:11434`): chave/CORS expostos ao cliente quando provider cloud for usado. Correção planejada: chat passa pela API (Fase 6), chaves ficam no servidor/env/EncryptedCredential.
2. **Editor textarea grava via API sem validação de tamanho/tipo verificada** — endurecer com Zod + limites na Fase 7/8.
3. **Sem rate limiting comprovado** em auth/IA — adicionar `@nestjs/throttler` na Fase 12 (dependência nova = gate R3).
4. **Sandbox de execução inexistente**: enquanto preview não existir, não há execução de código de usuário (risco zero por ausência; ao implementar, isolamentos obrigatórios: container/WebContainer, allowlist de comandos, sem interpolação shell, timeout/recursos).
5. **Path traversal**: escrita de arquivos do projeto deve normalizar caminho e rejeitar `..`/symlink fora do workspace do projeto (obrigatório na Fase 7 antes de qualquer tool de escrita).

## Regras permanentes
- Segredos nunca em repo, bundle de cliente ou log (R4). `.env.example` só com nomes.
- Validação Zod em toda rota. Cookies httpOnly (+Secure/SameSite em produção).
- Ações destrutivas (delete, restore, push, deploy) exigem confirmação explícita.
- SSRF: base URLs customizadas de providers validadas; exceção apenas para Ollama local explicitamente configurado.
- Auditoria: tool calls e operações sensíveis registrados com timestamp e resultado.

## Verificações a executar quando infra permitir
- Teste 2-usuários/2-projetos (leitura, escrita, execução, restauração cruzadas devem falhar).
- `pnpm audit` / `npm audit` nas branches (não rodado ainda — registrado como pendência).
- Playwright + axe nos fluxos principais (Fase 12).
