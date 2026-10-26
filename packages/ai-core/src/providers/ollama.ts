/**
 * Adaptador OllamaLocal — comunicação direta navegador -> http://localhost:11434.
 * Zero exposição: nenhum prompt/endpoint vai ao backend VORQEN.
 */
import {
  AiCoreError,
  AiProviderAdapter,
  ChatMessageDto,
  ConnectionTestResult,
  FileOperation,
  ModelInfo,
  ProviderConfig,
  StreamChunk,
} from '../types';

const REQUEST_TIMEOUT_MS = 8000;

export class OllamaLocalProvider implements AiProviderAdapter {
  readonly id = 'ollama' as const;

  private url(config: ProviderConfig, path: string): string {
    const base = config.baseUrl.replace(/\/+$/, '');
    return `${base}${path}`;
  }

  /** Normaliza erros de rede do browser em códigos acionáveis para a UI. */
  private classifyError(err: unknown, config: ProviderConfig): AiCoreError {
    if (err instanceof AiCoreError) return err;

    const name = (err as { name?: string })?.name ?? '';
    const message = (err as { message?: string })?.message ?? String(err);
    const isHttpsPage =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isHttpLocal = config.baseUrl.startsWith('http://');

    if (isHttpsPage && isHttpLocal) {
      return new AiCoreError(
        'Mixed Content: uma página HTTPS não pode chamar um endpoint HTTP local.',
        'MIXED_CONTENT',
        err,
      );
    }
    if (name === 'AbortError' && message.toLowerCase().includes('timeout')) {
      return new AiCoreError('Tempo limite excedido ao contatar o Ollama.', 'TIMEOUT', err);
    }
    if (name === 'TypeError') {
      // fetch falha opaca no browser: CORS bloqueado ou servidor desligado.
      return new AiCoreError(
        'Falha de conexão com o Ollama. Verifique se ele está rodando e se OLLAMA_ORIGINS permite esta origem.',
        'CORS_BLOCKED',
        err,
      );
    }
    return new AiCoreError(`Erro inesperado: ${message}`, 'CONNECTION_REFUSED', err);
  }

  async listModels(config: ProviderConfig): Promise<ModelInfo[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(this.url(config, '/api/tags'), {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new AiCoreError(
          `Ollama respondeu ${res.status} em /api/tags.`,
          'CONNECTION_REFUSED',
        );
      }
      const json = (await res.json()) as {
        models?: Array<{ name: string; size?: number; modified_at?: string; digest?: string }>;
      };
      return (json.models ?? []).map((m) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
      }));
    } catch (err) {
      throw this.classifyError(err, config);
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(config: ProviderConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const models = await this.listModels(config);
      const latencyMs = Math.round(performance.now() - start);
      if (models.length === 0) {
        return {
          ok: true,
          latencyMs,
          models,
          hints: [
            'Conexão OK, mas nenhum modelo baixado. Rode: ollama pull qwen2.5-coder:7b',
          ],
        };
      }
      return { ok: true, latencyMs, models };
    } catch (err) {
      const e = err instanceof AiCoreError ? err : this.classifyError(err, config);
      const hintsByCode: Record<string, string[]> = {
        MIXED_CONTENT: [
          'Acesse a plataforma via http://localhost:3000 (não https) durante o desenvolvimento,',
          'ou exponha o Ollama atrás de um proxy TLS local (ex: Caddy).',
        ],
        CORS_BLOCKED: [
          'Ollama precisa permitir esta origem. Configure a variável de ambiente:',
          'OLLAMA_ORIGINS=* ollama serve',
          '(macOS: `launchctl setenv OLLAMA_ORIGINS "*"` antes de abrir o Ollama App)',
        ],
        CONNECTION_REFUSED: [
          'Confirme que o Ollama está rodando: curl http://localhost:11434/api/tags',
        ],
        TIMEOUT: ['Aumente o timeout ou verifique se a porta 11434 está correta.'],
        MODEL_NOT_FOUND: ['Rode `ollama pull <modelo>` para baixar o modelo selecionado.'],
        INVALID_RESPONSE: ['Formato inesperado do Ollama. Atualize para a versão mais recente.'],
      };
      return {
        ok: false,
        latencyMs: Math.round(performance.now() - start),
        models: [],
        error: e.message,
        hints: hintsByCode[e.code] ?? [],
      };
    }
  }

  async *streamChat(
    config: ProviderConfig,
    messages: ChatMessageDto[],
    signal?: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    let res: Response;
    try {
      res = await fetch(this.url(config, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ model: config.model, messages, stream: true }),
      });
    } catch (err) {
      throw this.classifyError(err, config);
    }
    if (!res.ok || !res.body) {
      throw new AiCoreError(
        `Ollama respondeu ${res.status} em /api/chat.`,
        res.status === 404 ? 'MODEL_NOT_FOUND' : 'CONNECTION_REFUSED',
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
        };
        yield { content: parsed.message?.content ?? '', done: Boolean(parsed.done) };
      }
    }
  }

  async generateFileOperations(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
  ): Promise<FileOperation[]> {
    let res: Response;
    try {
      res = await fetch(this.url(config, '/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: config.model,
          stream: false,
          format: 'json',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
    } catch (err) {
      throw this.classifyError(err, config);
    }
    if (!res.ok) {
      throw new AiCoreError(
        `Ollama respondeu ${res.status}.`,
        res.status === 404 ? 'MODEL_NOT_FOUND' : 'CONNECTION_REFUSED',
      );
    }
    const json = (await res.json()) as { message?: { content?: string } };
    const raw = json.message?.content;
    if (!raw) throw new AiCoreError('Resposta do modelo sem conteúdo.', 'INVALID_RESPONSE');
    try {
      const parsed = JSON.parse(raw) as { operations?: FileOperation[] } | FileOperation[];
      const ops = Array.isArray(parsed) ? parsed : (parsed.operations ?? []);
      return ops.filter(
        (op) =>
          ['create', 'edit', 'delete'].includes(op.action) && typeof op.path === 'string',
      );
    } catch (err) {
      throw new AiCoreError('Modelo retornou JSON inválido.', 'INVALID_RESPONSE', err);
    }
  }
}
