# ADR-0102 — Estratégia de autenticação (DECISÃO PENDENTE DO USUÁRIO)

Data: 2026-10-31 · Status: PROPOSTO — aguarda escolha do usuário

## Estado verificado (não presumido)
- Na base recomendada `ci/cd-authentication-audit-5d2e3`: JWT Passport (`jwt.strategy.ts`, `JwtAuthGuard extends AuthGuard('jwt')`), `auth.service.ts:54` `this.jwt.signAsync({ sub, email })`, expiração `JWT_EXPIRES_IN=1d` (`.env.example`), hash **bcryptjs** rounds configurável, e token guardado em **localStorage** no web (comentário literal `login/page.tsx:21`).
- O schema tem tabela `Session` (tokenHash unique) que **nenhum código usa** → contradição schema×código (DB-AUDIT).
- Prompt mestre §5.1 prefere cookie httpOnly; R4 proíbe segredo exposto. localStorage + Bearer é vulnerável a XSS (risco registrado S2 potencial quando houver conteúdo gerado renderizado no mesmo domínio).

## Opções
| # | Opção | Custo | Prós | Contras |
|---|---|---|---|---|
| A | **Manter JWT Bearer atual** e só endurecer (CSP, escopo mínimo) | baixo | zero migração; testes atuais passam | XSS pode roubar token; sem revogação server-side |
| B | **JWT access curto em cookie httpOnly + refresh rotativo** usando a tabela `Session` já existente (tokenHash) | médio | alinha com §5.1; dá revogação/logout global; reaproveita schema órfão | exige CSRF protection (SameSite=Lax+), mexer api-client e AuthGate |
| C | **NextAuth/Auth.js** no web + API externa | alto | rápido para login social | duplicaria auth com Nest; troca arquitetura; menos controle sobre Session table |

## Recomendação
**Opção B** — é a única que resolve a contradição schema×código, atende o prompt mestre e mantém a API Nest como fonte de verdade. Escopo: access token 15 min em cookie httpOnly SameSite=Lax, refresh 7 dias hasheado em `Session`, endpoint `/auth/logout` marcando revogação, testes de isolamento mantidos.

## Pergunta ao usuário
Escolher A, B ou C. Mudança de sessão afeta `auth.*`, `api-client.ts`, `AuthGate.tsx` e `.env.example` (novos nomes JWT_ACCESS_SECRET/JWT_REFRESH_SECRET) — nada será implementado sem tua resposta.
