'use client';

/**
 * VORQEN — Fase 2/3 (Web): ChatPanel
 * Chat de programação 100% client-side (Opção A):
 *   Browser --fetch--> http://localhost:11434/api/chat (streaming NDJSON)
 * via OllamaLocalProvider de @vorqen/ai-core. O backend NestJS NÃO participa.
 *
 * Renderiza o streaming em tempo real e mantém as mensagens em memória por
 * projeto (persistência no Postgres via apps/api fica para a próxima iteração
 * de CRUD — aqui só UI + IA local).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getProvider,
  type ChatMessageDto,
  type ProviderConfig,
} from '@vorqen/ai-core';
import { readStoredAiConfig } from '../../lib/ai/config-store';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CODEGEN_PREAMBLE =
  'Você é o agente de engenharia do VORQEN. Responda em markdown simples. ' +
  'Quando for gerar/editar código, use blocos cercados por ``` com a linguagem. ' +
  'Seja conciso e prático.';

export function ChatPanel({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Lê a config salva na tela de Settings (localStorage `vorqen:ai-config`).
  useEffect(() => {
    const stored = readStoredAiConfig();
    if (stored.baseUrl && stored.model) {
      setConfig({ id: stored.id, baseUrl: stored.baseUrl, model: stored.model });
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || streaming) return;
    if (!config) {
      setError(
        'Nenhum provedor configurado. Vá em /settings/providers, salve a URL do Ollama e escolha um modelo.',
      );
      return;
    }

    setError(null);
    setInput('');
    const history: UiMessage[] = [...messages, { role: 'user', content: prompt }];
    setMessages(history);
    setStreaming(true);

    // Mensagem placeholder do assistente sendo preenchida pelo stream.
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const dto: ChatMessageDto[] = [
      { role: 'system', content: CODEGEN_PREAMBLE },
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessageDto),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const provider = getProvider(config.id);
      let acc = '';
      for await (const chunk of provider.streamChat(config, dto, controller.signal)) {
        if (controller.signal.aborted) break;
        if (!chunk.content) continue;
        acc += chunk.content;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: acc };
          return next;
        });
      }
      if (!acc) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'assistant',
            content: '_O modelo não retornou conteúdo._',
          };
          return next;
        });
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        // Cancelamento manual: mantém o que já foi streamado.
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        // Remove o placeholder vazio em caso de falha de rede/CORS.
        setMessages((prev) =>
          prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev,
        );
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [config, input, messages, streaming]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Barra de status do provedor local */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400">
        <span>
          Projeto <span className="font-mono text-zinc-200">{projectId}</span>
        </span>
        {config ? (
          <span className="font-mono">
            🟢 {config.model} @ {config.baseUrl}{' '}
            <span className="text-zinc-500">(browser → localhost, Opção A)</span>
          </span>
        ) : (
          <a
            href="/settings/providers"
            className="text-amber-400 underline decoration-dotted hover:text-amber-300"
          >
            ⚠️ Provedor não configurado — configurar agora
          </a>
        )}
      </div>

      {/* Lista de mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500">
            Descreva a aplicação que você quer construir. Ex:{' '}
            <em>&ldquo;Crie uma landing page com hero, form de cadastro e dark mode&rdquo;</em>.
            A resposta chega em streaming direto do seu Ollama local.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[80%] whitespace-pre-wrap rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white'
                  : 'max-w-[85%] whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200'
              }
            >
              {m.content}
              {streaming && i === messages.length - 1 && m.role === 'assistant' && (
                <span className="ml-1 inline-block animate-pulse text-indigo-400">▍</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Erro (CORS/Mixed Content/etc.) */}
      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-300">
          <strong>Falha na conexão local:</strong> {error}
          <div className="mt-1 text-xs text-red-400">
            Lembre-se: inicie o Ollama com{' '}
            <code className="rounded bg-red-900/50 px-1 py-0.5 font-mono">
              OLLAMA_ORIGINS=&quot;*&quot; ollama serve
            </code>{' '}
            e acesse a plataforma via <code className="font-mono">http://localhost:3000</code>.
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          placeholder="Descreva o que construir… (Enter envia, Shift+Enter quebra linha)"
          className="flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-indigo-500"
          disabled={streaming}
        />
        {streaming ? (
          <button
            onClick={stop}
            className="h-12 rounded-lg border border-zinc-700 bg-zinc-800 px-5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700"
          >
            ⏹ Parar
          </button>
        ) : (
          <button
            onClick={() => void send()}
            disabled={!input.trim()}
            className="h-12 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {config ? 'Enviar ➤' : 'Configurar IA primeiro'}
          </button>
        )}
      </div>
    </div>
  );
}
