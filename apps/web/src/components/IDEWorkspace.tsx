'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FileOperation } from '@vorqen/ai-core';
import { getProject, saveProjectFiles } from '../lib/api-client';
import { ChatPanel } from './ChatPanel';

interface IDEWorkspaceProps {
  projectId: string;
}

const DEFAULT_FILES: FileOperation[] = [
  { path: 'src/App.tsx', content: 'export default function App() {\n  return <h1>Hello VORQEN</h1>;\n}\n' },
];

export function IDEWorkspace({ projectId }: IDEWorkspaceProps) {
  const [files, setFiles] = useState<FileOperation[]>(DEFAULT_FILES);
  const [activePath, setActivePath] = useState<string>(DEFAULT_FILES[0]?.path ?? '');
  const [model, setModel] = useState('llama3.2');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProject(projectId)
      .then((project) => {
        if (cancelled) return;
        if (project.files.length > 0) {
          setFiles(project.files);
          setActivePath(project.files[0].path);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const activeFile = files.find((file) => file.path === activePath);

  function updateContent(content: string) {
    setFiles((current) =>
      current.map((file) => (file.path === activePath ? { ...file, content } : file)),
    );
  }

  function applyGeneratedFiles(generated: FileOperation[]) {
    setFiles((current) => {
      const byPath = new Map(current.map((file) => [file.path, file]));
      for (const file of generated) byPath.set(file.path, file);
      const merged = [...byPath.values()];
      setActivePath(merged[0]?.path ?? '');
      return merged;
    });
  }

  // Botão "Salvar": envia os arquivos do editor para a API REST (NestJS + Prisma).
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await saveProjectFiles(projectId, files);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error instanceof Error ? error.message : 'Falha ao salvar.');
    }
  }, [projectId, files]);

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-brand-300">VORQEN IDE</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            className="w-64 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            title="URL do Ollama local"
          />
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-36 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            title="Modelo Ollama"
          />
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === 'saved' && <span className="text-xs text-emerald-400">Salvo ✓</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-400">{saveError}</span>}
          <button
            onClick={() => void handleSave()}
            disabled={saveStatus === 'saving'}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-56 shrink-0 overflow-y-auto border-r border-slate-800 p-2">
          <p className="px-2 pb-2 text-xs uppercase tracking-wide text-slate-500">Arquivos</p>
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => setActivePath(file.path)}
              className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                file.path === activePath ? 'bg-slate-800 text-brand-300' : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              {file.path}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <textarea
            value={activeFile?.content ?? ''}
            onChange={(event) => updateContent(event.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none"
          />
        </main>

        <ChatPanel
          projectId={projectId}
          model={model}
          baseUrl={baseUrl}
          onGeneratedFiles={applyGeneratedFiles}
        />
      </div>
    </div>
  );
}
