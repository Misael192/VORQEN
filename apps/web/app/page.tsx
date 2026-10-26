import Link from 'next/link';
import { listProjects, type ProjectDto } from '../src/lib/api-client';
import { AuthGate } from '../src/components/AuthGate';

async function Dashboard() {
  let projects: ProjectDto[] = [];
  let apiError: string | null = null;

  try {
    projects = await listProjects();
  } catch (error) {
    apiError = error instanceof Error ? error.message : 'API indisponível.';
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-black text-slate-950">
            V
          </div>
          <h1 className="text-xl font-bold">VORQEN</h1>
        </div>
        <Link href="/login" className="text-sm text-slate-400 hover:text-brand-300">
          Entrar / Sair
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <h2 className="mb-4 text-lg font-semibold">Seus projetos</h2>

        {apiError && (
          <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-3 text-sm text-amber-300">
            {apiError} — verifique se a API está em execução (<code>pnpm dev:api</code>) e se você está logado.
          </p>
        )}

        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/ide/${project.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-brand-500"
              >
                <p className="font-semibold">{project.name}</p>
                <p className="text-sm text-slate-400">{project.description ?? 'Sem descrição'}</p>
              </Link>
            </li>
          ))}
          {!apiError && projects.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              Nenhum projeto ainda. Crie um com <code>POST /api/v1/projects</code> ou pela interface de chat.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
