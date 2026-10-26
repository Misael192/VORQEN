'use client';

/**
 * VORQEN — Fase 2 (Web): AIConfigForm
 * Lê e salva { baseUrl, model } no localStorage e usa o OllamaLocalProvider
 * de @vorqen/ai-core para fazer fetch DIRETO do navegador para
 * http://localhost:11434 (/api/tags e /api/chat).
 *
 * Zero exposição (Opção A): nada desta tela toca o backend NestJS.
 * CORS: requer que o usuário inicie o Ollama com OLLAMA_ORIGINS="*"
 * (documentado no próprio formulário).
 */
import { useCallback, useEffect, useState } from 'react';
import { getProvider, type ConnectionTestResult, type ProviderConfig } from '@vorqen/ai-core';
import {
  readStoredAiConfig,
  saveAiConfig,
} from '../../lib/ai/config-store';

type Status = 'idle' | 'testing' | 'saving' | 'chatting';

export function AIConfigForm() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [model, setModel] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatOutput, setChatOutput] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  // Hidratação do localStorage no mount (client-side apenas).
  useEffect(() => {
    const stored = readStoredAiConfig();
    setBaseUrl(stored.baseUrl);
    setModel(stored.model);
  }, []);

  const provider = getProvider('ollama');

  const config: ProviderConfig = { id: 'ollama', baseUrl, model };

  const save = useCallback(
    (nextModel?: string) => {
      saveAiConfig({
        id: 'ollama',
        baseUrl: baseUrl.trim() || 'http://localhost:11434',
        model: nextModel ?? model,
      });
      setStatus('saving');
      setSavedFlash(true);
      setTimeout(() => {
        setSavedFlash(false);
        setStatus('idle');
      }, 1500);
    },
    [baseUrl, model],
  );

  const testConnection = useCallback(async () => {
    setStatus('testing');
    setResult(null);
    const res = await provider.testConnection({ ...config, model: '' });
    setResult(res);
    setModels(res.models.map((m) => m.name));
    if (res.ok && res.models.length > 0 && !model) {
      setModel(res.models[0].name);
      save(res.models[0].name);
    }
    setStatus('idle');
  }, [config, model, provider, save]);

  /** Smoke-test real em /api/chat via streamChat do ai-core (browser -> localhost). */
  const runSmokeChat = useCallback(async () => {
    if (!model || !chatInput.trim()) return;
    setStatus('chatting');
    setChatOutput('');
    try {
      for await (const chunk of provider.streamChat(
        config,
        [{ role: 'user', content: chatInput }],
      )) {
        setChatOutput((prev) => prev + chunk.content);
        if (chunk.done) break;
      }
    } catch (err) {
      setChatOutput(err instanceof Error ? err.message : 'Falha na chamada ao /api/chat.');
    } finally {
      setStatus('idle');
    }
  }, [chatInput, config, model, provider]);

  const connected = result?.ok === true;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
          Provedor local — Ollama
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Conexão direta do navegador para{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-xs text-indigo-300">
            http://localhost:11434
          </code>
          . Seus prompts nunca passam pelos servidores do VORQEN.
        </p>
      </header>

      {/* Aviso de CORS — requisito do lado do usuário */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
        <p className="mb-1 font-semibold">Requisito de CORS (uma vez só, na sua máquina):</p>
        <p>
          Inicie o Ollama permitindo requisições do navegador:{' '}
          <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-amber-300">
            OLLAMA_ORIGINS=&quot;*&quot; ollama serve
          </code>{' '}
          — no macOS app, rode antes de abri-lo:{' '}
          <code className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-amber-300">
            launchctl setenv OLLAMA_ORIGINS &quot;*&quot;
          </code>
          . Acesse esta plataforma por{' '}
          <strong>http://localhost:3000</strong> (nunca https) para evitar bloqueio de Mixed
          Content.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div>
          <label htmlFor="baseUrl" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Base URL
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        <div>
          <label htmlFor="model" className="mb-1.5 block text-sm font-medium text-zinc-300">
            Modelo
          </label>
          {models.length > 0 ? (
            <select
              id="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                save(e.target.value);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="">Selecione…</option>
              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="model"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="ex: qwen2.5-coder:7b (ou clique em Testar Conexão)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={testConnection}
            disabled={status === 'testing'}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'testing' && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {status === 'testing' ? 'Testando…' : 'Testar Conexão'}
          </button>
          <button
            type="button"
            onClick={() => save()}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Salvar no navegador
          </button>
          {savedFlash && (
            <span className="text-xs text-emerald-400">Salvo em localStorage ✓</span>
          )}
          {connected && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {result?.latencyMs}ms · {models.length} modelo(s)
            </span>
          )}
        </div>

        {result && !result.ok && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <p className="font-medium">Falha ao conectar ({result.latencyMs}ms)</p>
            <p className="mt-1 opacity-90">{result.error}</p>
            {result.hints && result.hints.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
                {result.hints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Smoke-test opcional contra /api/chat com streaming real */}
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-sm font-semibold text-zinc-200">
          Smoke-test de inferência (/api/chat)
        </h3>
        <textarea
          rows={2}
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder={model ? `Pergunte algo a ${model}…` : 'Conecte-se e selecione um modelo primeiro.'}
          disabled={!model || status === 'chatting'}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={runSmokeChat}
          disabled={!model || status === 'chatting' || !chatInput.trim()}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'chatting' ? 'Gerando…' : 'Enviar ao Ollama'}
        </button>
        {chatOutput && (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-300">
            {chatOutput}
          </pre>
        )}
      </div>
    </section>
  );
}
