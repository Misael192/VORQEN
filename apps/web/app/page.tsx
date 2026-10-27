'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  ProjectSummary,
  clearToken,
  createProject,
  getProjects,
  getToken,
} from '@/lib/api-client';

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar seus projetos.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    void load();
  }, [load, router]);

  async function handleNewProject() {
    setCreating(true);
    setError(null);
    try {
      const project = await createProject('Novo App');
      router.push(`/editor/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Nao foi possivel criar o projeto.');
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-[#111318] text-[#E8EAF0]">
      <header className="border-b border-[#343947] bg-[#1B1E26]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8B7CFF] font-black text-[#111318]">
              V
            </div>
            <p className="text-lg font-bold">VORQEN</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-[#343947] px-3 py-1.5 text-sm text-[#A0A6B5] transition hover:border-[#8B7CFF] hover:text-[#E8EAF0]"
          >
            Sair
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Meus projetos</h1>
            <p className="mt-1 text-sm text-[#A0A6B5]">
              Crie, edite e visualize apps gerados com IA local (Ollama).
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewProject}
            disabled={creating}
            className="rounded-lg bg-[#8B7CFF] px-4 py-2 text-sm font-semibold text-[#111318] transition hover:bg-[#A397FF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? 'Criando...' : 'Novo Projeto'}
          </button>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-[#F16B75]/40 bg-[#F16B75]/10 px-4 py-3 text-sm text-[#F16B75]"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-[#A0A6B5]">Carregando projetos...</p>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#343947] bg-[#1B1E26] p-12 text-center">
            <p className="text-lg font-semibold">Nenhum projeto ainda.</p>
            <p className="mt-2 text-sm text-[#A0A6B5]">
              Nenhum projeto ainda. Crie um para começar.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/editor/${project.id}`}
                  className="block h-full rounded-xl border border-[#343947] bg-[#1B1E26] p-5 transition hover:border-[#8B7CFF]"
                >
                  <p className="truncate text-base font-semibold">{project.name}</p>
                  <p className="mt-1 text-xs text-[#A0A6B5]">
                    {project.hasFiles ? 'Com arquivos salvos' : 'Projeto vazio'}
                  </p>
                  <p className="mt-3 text-xs text-[#A0A6B5]">
                    Atualizado em {new Date(project.updatedAt).toLocaleDateString('pt-BR')}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
