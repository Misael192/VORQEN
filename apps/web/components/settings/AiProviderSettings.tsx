'use client';

/**
 * Tela: Configurações -> Provedores de IA (Fase 2 do MVP).
 * O usuário informa a URL local do Ollama, testa a conexão e vê os modelos
 * baixados. Toda a comunicação é browser -> localhost:11434 (Opção A):
 * NENHUM dado desta tela é enviado ao backend VORQEN.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getProvider,
  type ConnectionTestResult,
  type ProviderConfig,
} from '@vorqen/ai-core';

const STORAGE_KEY = 'vorqen.ai-provider-config';
const DEFAULT_CONFIG: ProviderConfig = {
  id: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: '',
};

export function AiProviderSettings() {
  const [config, setConfig] = useState<ProviderConfig>(DEFAULT_CONFIG);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Hidratação a partir do localStorage (nunca do nosso servidor).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULT_CONFIG, ...(JSON.parse(raw) as ProviderConfig) });
    } catch {
      /* config corrompida: mantém defaults */
    }
  }, []);

  const persist = useCallback((next: ProviderConfig) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConfig(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const testConnection = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const provider = getProvider(config.id);
      const res = await provider.testConnection(config);
      setResult(res);
      if (res.ok && res.models.length > 0 && !config.model) {
        persist({ ...config, model: res.models[0].name });
      }
    } finally {
      setTesting(false);
    }
  }, [config, persist]);

  return (
    <section className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Provedores de IA
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Execução 100% local via Ollama. Seus prompts e endpoints nunca saem
          desta máquina para os servidores do VORQEN.
        </p>
      </header>

      {/* Card estilo shadcn/ui */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <label htmlFor="provider" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Provedor
            </label>
            <select
              id="provider"
              value={config.id}
              onChange={(e) => setConfig({ ...config, id: e.target.value as ProviderConfig['id'] })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            >
              <option value="ollama">Ollama (local)</option>
              <option value="openai" disabled>OpenAI (em breve)</option>
              <option value="anthropic" disabled>Anthropic (em breve)</option>
            </select>
          </div>

          <div>
            <label htmlFor="baseUrl" className="mb-1.5 block text-sm font-medium text-zinc-300">
              URL do Ollama
            </label>
            <input
              id="baseUrl"
              type="url"
              inputMode="url"
              placeholder="http://localhost:11434"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Dica: inicie o Ollama permitindo esta origem —{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-indigo-300">
                OLLAMA_ORIGINS=* ollama serve
              </code>
            </p>
          </div>

          <div>
            <label htmlFor="model" className="mb-1.5 block text-sm font-medium text-zinc-300">
              Modelo
            </label>
            {result?.models && result.models.length > 0 ? (
              <select
                id="model"
                value={config.model}
                onChange={(e) => persist({ ...config, model: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              >
                {result.models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {m.size ? ` — ${(m.size / 1e9).toFixed(1)} GB` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="model"
                placeholder="ex: qwen2.5-coder:7b (clique em Testar Conexão)"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {testing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Testando…
                </>
              ) : (
                'Testar Conexão'
              )}
            </button>
            <button
              type="button"
              onClick={() => persist(config)}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Salvar
            </button>
            {saved && <span className="text-xs text-emerald-400">Salvo localmente ✓</span>}
          </div>
        </div>

        {/* Resultado do teste */}
        {result && (
          <div
            className={
              'mt-5 rounded-lg border p-4 text-sm ' +
              (result.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300')
            }
          >
            <p className="font-medium">
              {result.ok
                ? `Conectado em ${result.latencyMs}ms · ${result.models.length} modelo(s) disponível(is)`
                : `Falha na conexão (${result.latencyMs}ms)`}
            </p>
            {!result.ok && result.error && <p className="mt-1 opacity-90">{result.error}</p>}
            {result.hints && result.hints.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
                {result.hints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
