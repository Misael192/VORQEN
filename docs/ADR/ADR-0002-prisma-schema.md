# ADR-0002 — Schema Prisma canônico: branch ci/cd (8 models)

Data: 2026-10-31 · Status: PROPOSTO

## Decisão
Schema canônico = `prisma/schema.prisma` da branch `ci/cd-authentication-audit-5d2e3`: User, Session, Project, AiConnection, EncryptedCredential, ProjectFile, ChatMessage, ProjectVersion, com as migrations `20261025175706_init` e `20261026000000_phase4_projects_files_chat`.

## Justificativa
- Único schema alinhado a código que compila e passa testes (9/9) — evidência: build/test executados em clone limpo nesta sessão; `grep "^model"` confirmou os 8 models.
- Inclui EncryptedCredential/AiConnection (necessários para BYOK seguro do sistema multimodelo) e ProjectVersion (histórico/restauração), ausentes na proposta de 6 models da arch.
- Nenhuma migration será apagada; alterações futuras de schema exigem autorização explícita (R3) e migration aditiva com rollback.

## Consequências
- Branch arch divergente fica como fonte de componentes/UI, não de dados.
- `migrate deploy` contra Postgres real está BLOCKED neste host (porta 5432 fechada; docker ausente). Desbloqueio: Docker instalado ou DATABASE_URL gerenciado fornecido pelo proprietário via env.
