# ADR-002: Correção de Rota — IA 100% Client-Side (Opção A)

**Data:** 2026-10-26
**Status:** Aceito
**Substitui:** plano anterior que previa módulo `ai` no NestJS (FASE 2 original)

## Contexto

A proposta inicial de fases colocava o "cérebro da IA" no backend NestJS
(Controller + SDK OpenAI/Anthropic + SSE). Isso viola a decisão estratégica
**Opção A**: inferência local via Ollama, custo zero de GPU e privacidade total.

## Decisão

1. **O backend NestJS NÃO faz proxy de IA.** Em `apps/api` ficam apenas:
   autenticação, CRUD de `Project`/`ProjectFile`/`ChatMessage` e health check.
   Nenhum controller, service ou rota SSE de IA é criado.
2. **Toda a orquestração do chat acontece no browser:**
   `apps/web -> http://localhost:11434` (Ollama do usuário), diretamente.
3. **Camada de abstração** em `packages/ai-core` (`AiProviderAdapter` +
   registry). MVP registra apenas `OllamaLocalProvider`; adaptadores
   `openai`/`anthropic` poderão ser adicionados sem tocar na UI.
4. **Zero exposição:** URLs locais, chaves e prompts nunca são enviados ao
   backend VORQEN. Persistimos no banco apenas metadados não sensíveis
   (nome do provedor, nome do modelo) via `AiModelConfig`.

## Consequências

- ✅ Custo zero de infraestrutura de inferência; privacidade por design.
- ⚠️ Dependemos do ambiente do usuário (ver desafios de CORS/Mixed Content em ADR-001).
- ℹ️ Streaming é feito com `fetch` + `ReadableStream` (NDJSON do `/api/chat`),
  não SSE server-side.
