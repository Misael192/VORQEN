'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createProvider,
  type FileOperation,
  type ILLMProvider,
  type Message,
} from '@vorqen/ai-core';
import { saveChatMessage } from '../lib/api-client';

interface ChatPanelProps {
  projectId: string;
  model: string;
  baseUrl: string;
  onGeneratedFiles: (files: FileOperation[]) => void;
}

/**
 * Painel de chat do workspace. Toda a comunicação com o Ollama acontece AQUI no
 * navegador, através do pacote compartilhado @vorqen/ai-core (createProvider +
 * streamChat). A API NestJS nunca recebe prompts nem executa inferência — ela
 * apenas persiste as mensagens/arquivos já validados no cliente.
 */
export function ChatPanel({ projectId, model, baseUrl, onGeneratedFiles }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = useMemo<ILLMProvider>(() => createProvider('ollama', baseUrl), [baseUrl]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || streaming) return;

    setInput('');
    setError(null);
    const history: Message[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      await saveChatMessage(projectId, 'user', content).catch(() => undefined);

      const stream = provider.streamChat(history, model);
      const reader = stream.getReader();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += value;
        setMessages([...history, { role: 'assistant', content: assistantText }]);
      }

      const files = parseGeneratedFiles(assistantText);
      if (files) {
        onGeneratedFiles(files);
      } else {
        setError('A resposta do modelo não continha JSON válido de arquivos.');
      }

      await saveChatMessage(projectId, 'assistant', assistantText).catch(() => undefined);
      setMessages((current) => [...current.slice(0, -1), { role: 'assistant', content: assistantText }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao conversar com o Ollama.');
    } finally {
      setStreaming(false);
    }
  }

  return (
    <aside className="flex h-full w-96 flex-col border-l border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 p-3 text-sm font-semibold text-slate-200">
        Chat IA <span className="text-slate-500">(Ollama direto do navegador)</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-8 rounded-lg bg-brand-500/20 p-2 text-sm text-slate-100'
                : 'mr-8 rounded-lg bg-slate-800/70 p-2 text-sm whitespace-pre-wrap text-slate-200'
            }
          >
            {message.content || '…'}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-3 pb-2 text-xs text-red-400">{error}</p>}

      <form
        className="flex gap-2 border-t border-slate-800 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Descreva o app que você quer gerar…"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          disabled={streaming}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {streaming ? '…' : 'Enviar'}
        </button>
      </form>
    </aside>
  );
}

function parseGeneratedFiles(raw: string): FileOperation[] | null {
  const candidate = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(candidate) as { files?: unknown };
    if (!Array.isArray(parsed.files)) return null;
    const files = parsed.files.filter(
      (file): file is FileOperation =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as FileOperation).path === 'string' &&
        typeof (file as FileOperation).content === 'string',
    );
    return files.length > 0 ? files : null;
  } catch {
    return null;
  }
}
