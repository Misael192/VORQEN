'use client';

/**
 * AIConfigForm - Tela de configuracao do provedor de IA local (Opcao A).
 *
 * O browser fala direto com o Ollama em http://localhost:11434.
 * Nada de IA passa pelo backend NestJS.
 *
 * Textos da UI seguem ASD-STE100: voz ativa, frases curtas, uma instrucao por frase.
 */

import { useCallback, useEffect, useState } from 'react';
import { getProvider, type ConnectionTestResult, type ModelInfo, type ProviderConfig } from '@vorqen/ai-core';

const STORAGE_KEY = 'vorqen:ai-config';
const DEFAULT_BASE_URL = 'http://localhost:11434';

interface StoredConfig {
  baseUrl: string;
  model: string;
}

function readStored(): StoredConfig {
  if (typeof window === 'undefined') {
    return { baseUrl: DEFAULT_BASE_URL, model: '' };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { baseUrl: DEFAULT_BASE_URL, model: '' };
    const parsed = JSON.parse(raw) as Partial<StoredConfig>;
    return {
      baseUrl: parsed.baseUrl ?? DEFAULT_BASE_URL,
      model: parsed.model ?? '',
    };
  } catch {
    return { baseUrl: DEFAULT_BASE_URL, model: '' };
  }
}

export function AIConfigForm() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'testing'>('idle');

  useEffect(() => {
    const stored = readStored();
    setBaseUrl(stored.baseUrl);
    setModel(stored.model);
  }, []);

  const save = useCallback((next: StoredConfig) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const handleTest = useCallback(async () => {
    setStatus('testing');
    setResult(null);
    const provider = getProvider('ollama');
    const config: ProviderConfig = { id: 'local', kind: 'ollama', baseUrl, model };
    try {
      const testResult = await provider.testConnection(config);
      setResult(testResult);
      if (testResult.ok) {
        setModels(testResult.models ?? []);
      }
    } catch (error) {
      setResult({
        ok: false,
        latencyMs: null,
        models: [],
        error: error instanceof Error ? error.message : 'O teste de conexao falhou.',
      });
    } finally {
      setStatus('idle');
    }
  }, [baseUrl, model]);

  const handleSave = useCallback(() => {
    save({ baseUrl, model });
  }, [baseUrl, model, save]);

  const failed = result !== null && !result.ok;

  return (
    <div className="mx-auto w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-neutral-100 shadow">
      <h2 className="text-lg font-semibold">Provedor de IA local</h2>
      <p className="mt-1 text-sm text-neutral-400">
        O VORQEN usa o Ollama na sua maquina. Nenhuma requisicao de IA sai do seu browser.
      </p>

      {/* Aviso de CORS: instrucao critica para o usuario configurar a origem. */}
      <div className="mt-4 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm">
        <p className="font-semibold">Configure o CORS uma vez, na sua maquina:</p>
        <p className="mt-1">Inicie o Ollama com a variavel OLLAMA_ORIGINS definida.</p>
        <pre className="mt-2 overflow-x-auto rounded bg-black/50 p-2 text-xs">
          OLLAMA_ORIGINS=&quot;*&quot; ollama serve
        </pre>
        <p className="mt-2">Acesse este site por http://. Sites https bloqueiam chamadas a localhost.</p>
      </div>

      <label className="mt-4 block text-sm font-medium" htmlFor="base-url">
        URL do Ollama
      </label>
      <input
        id="base-url"
        type="url"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder={DEFAULT_BASE_URL}
        className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="model">
        Modelo
      </label>
      <select
        id="model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">Selecione um modelo baixado</option>
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name}
          </option>
        ))}
        {model && !models.some((m) => m.name === model) && (
          <option value={model}>{model}</option>
        )}
      </select>

      {failed && (
        <div role="alert" className="mt-4 rounded-md border border-red-700 bg-red-950/50 p-3 text-sm">
          <p className="font-semibold">O Ollama nao esta acessivel.</p>
          <p className="mt-1">{result?.error}</p>
          <p className="mt-1">Verifique as instrucoes de CORS acima.</p>
        </div>
      )}

      {result?.ok && (
        <div className="mt-4 rounded-md border border-emerald-700 bg-emerald-950/40 p-3 text-sm">
          <p className="font-semibold">Conexao estabelecida.</p>
          <p className="mt-1">
            {models.length} modelo(s) encontrados em {baseUrl} ({result.latencyMs} ms).
          </p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={status === 'testing'}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          {status === 'testing' ? 'Testando...' : 'Testar Conexao'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-800"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export default AIConfigForm;
