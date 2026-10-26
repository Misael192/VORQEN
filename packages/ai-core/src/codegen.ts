/**
 * VORQEN — ai-core / codegen
 * Camada de prompts para geração de código (Fase 3 do MVP).
 * Fica no pacote compartilhado para que o Chat do apps/web e futuros
 * agentes reutilizem exatamente o mesmo contrato de saída do modelo.
 *
 * IMPORTANTE (Opção A): estes prompts são montados e enviados NO NAVEGADOR
 * diretamente ao Ollama local. Nunca trafegam pelo backend VORQEN.
 */
import {
  AiCoreError,
  FileOperation,
  ProviderConfig,
  getProvider,
} from './index';

/** Estrutura de arquivos que acompanha o contexto enviado ao modelo. */
export interface ProjectFileEntry {
  path: string;
  content?: string;
}

/** Contrato JSON exigido do modelo (espelho de FileOperation em types.ts). */
const OPERATIONS_JSON_SCHEMA = `{
  "operations": [
    { "action": "create" | "edit" | "delete", "path": "caminho/do/arquivo.tsx", "content": "conteúdo completo do arquivo (string)" }
  ]
}` as const;

/**
 * System prompt para o chat de programação.
 * Instrui o modelo a responder APENAS com operações estruturadas de arquivo,
 * que serão aplicadas no Monaco Editor e no WebContainer.
 */
export function buildCodegenSystemPrompt(fileTree: ProjectFileEntry[]): string {
  const tree = fileTree.length > 0
    ? fileTree.map((f) => `- ${f.path}`).join('\n')
    : '- (projeto vazio)';

  return [
    'Você é o agente de engenharia do VORQEN, uma plataforma que constrói apps por linguagem natural.',
    'Você opera um workspace de projeto e DEVE responder apenas com JSON válido no formato:',
    OPERATIONS_JSON_SCHEMA,
    '',
    'REGRAS:',
    '1. Use "create" para arquivos novos, "edit" para sobrescrever existentes e "delete" para remover.',
    '2. Em "edit", forneça o conteúdo COMPLETO do arquivo resultante (não diffs).',
    '3. Caminhos são relativos à raiz do projeto (ex: "src/App.tsx", "package.json").',
    '4. Gere código React + TypeScript + Tailwind CSS funcional e auto-contido.',
    '5. Nunca envolva o JSON em markdown, comentários ou texto adicional.',
    '',
    'ESTRUTURA ATUAL DO PROJETO:',
    tree,
  ].join('\n');
}

/** Monta a mensagem do usuário com o pedido + contexto opcional de arquivos. */
export function buildCodegenUserPrompt(
  request: string,
  contextFiles: ProjectFileEntry[] = [],
): string {
  if (contextFiles.length === 0) return request;
  const ctx = contextFiles
    .filter((f) => typeof f.content === 'string' && f.content.length > 0)
    .map((f) => `=== ${f.path} ===\n${f.content}`)
    .join('\n\n');
  return `${request}\n\nCONTEXTO DE ARQUIVOS:\n${ctx}`;
}

/** Valida e normaliza as operações retornadas pelo modelo. */
export function parseFileOperations(raw: unknown): FileOperation[] {
  const ops = Array.isArray(raw) ? raw : (raw as { operations?: unknown }).operations;
  if (!Array.isArray(ops)) {
    throw new AiCoreError('O modelo não retornou um array de operações.', 'INVALID_RESPONSE');
  }
  const valid: FileOperation[] = [];
  for (const op of ops as Partial<FileOperation>[]) {
    if (!op || typeof op.path !== 'string' || op.path.trim() === '') continue;
    if (op.action !== 'create' && op.action !== 'edit' && op.action !== 'delete') continue;
    if (op.action !== 'delete' && typeof op.content !== 'string') continue;
    valid.push({
      action: op.action,
      path: op.path.replace(/^\/+/, ''),
      content: op.action === 'delete' ? undefined : op.content,
    });
  }
  if (valid.length === 0) {
    throw new AiCoreError('Nenhuma operação de arquivo válida no JSON retornado.', 'INVALID_RESPONSE');
  }
  return valid;
}

/**
 * Orquestra uma rodada de codegen 100% client-side:
 * monta os prompts -> chama o provider local -> valida o JSON de saída.
 */
export async function runCodegen(
  config: ProviderConfig,
  userRequest: string,
  fileTree: ProjectFileEntry[],
  signal?: AbortSignal,
): Promise<FileOperation[]> {
  const provider = getProvider(config.id);
  const systemPrompt = buildCodegenSystemPrompt(fileTree);
  const userPrompt = buildCodegenUserPrompt(userRequest);
  const operations = await provider.generateFileOperations(
    config,
    systemPrompt,
    userPrompt,
    signal,
  );
  return parseFileOperations(operations);
}

/** Aplica as operações sobre um mapa de arquivos em memória (Monaco/WebContainer fs). */
export function applyFileOperations(
  files: Map<string, string>,
  operations: FileOperation[],
): Map<string, string> {
  const next = new Map(files);
  for (const op of operations) {
    if (op.action === 'delete') {
      next.delete(op.path);
    } else {
      next.set(op.path, op.content ?? '');
    }
  }
  return next;
}
