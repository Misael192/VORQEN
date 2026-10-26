# ADR-001: Estratégia de Conexão Browser -> Ollama Local

## Desafios

Ao conectar `apps/web` (navegador) diretamente a `http://localhost:11434`:

1. **CORS** — o Ollama, por padrão, rejeita requisições de origens externas à CLI.
   - **Solução:** instruir o usuário a iniciar o Ollama com `OLLAMA_ORIGINS`.
     A UI de configurações exibe o comando exato para SO do usuário e o teste
     de conexão classifica a falha opaca `TypeError` do browser como
     `CORS_BLOCKED`, mostrando o passo a passo corretivo.
2. **Mixed Content** — uma página servida via HTTPS não pode fazer fetch a um
   endpoint HTTP local (bloqueio passivo/ativo do navegador).
   - **Solução (MVP):** rodar a plataforma em dev via `http://localhost:3000`.
   - **Produção futura:** proxy TLS local (Caddy `tls internal`) ou extensão
     companion; detectado proativamente por `window.location.protocol === 'https:'`.
3. **Privacidade / Zero Exposição** — prompts, URLs locais e chaves nunca
   trafegam pelo backend VORQEN. Toda orquestração é client-side
   (`packages/ai-core`). No banco salvamos apenas metadados (provedor/modelo).
4. **Falhas de rede opacas** — `fetch` lança `TypeError` sem distinguir
   servidor desligado de CORS. O adaptador normaliza em `AiCoreError.code`
   (`CONNECTION_REFUSED | CORS_BLOCKED | MIXED_CONTENT | TIMEOUT | MODEL_NOT_FOUND`)
   com hints acionáveis retornados ao componente de Settings.

## Estratégia de Unificação de Branches (Git)

A branch solicitada `feat/fase-1-ai-core` **não existe neste ambiente**:
o repositório não possui remote `origin` (apenas `main` + branches locais de
sessão). Em vez de um merge vazio/falso, o conteúdo da Fase 1 de IA
(`packages/ai-core` com `OllamaLocalProvider`, estrutura `replica/`) foi
**recriado diretamente na branch de trabalho**, preservando intactas as
alterações de banco (schema.prisma + migration determinística), conforme a
regra de resolução de conflitos ("mantenha a sua versão do schema").
