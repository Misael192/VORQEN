export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <div className="max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-12 shadow-2xl shadow-brand-900/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-black text-slate-950">
            V
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-200">Platform</p>
            <h1 className="text-3xl font-bold">VORQEN</h1>
          </div>
        </div>

        <p className="text-lg text-slate-300">
          An AI-native workspace for building, editing, versioning and previewing software projects.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Projects</p>
            <p className="mt-2 text-2xl font-semibold text-brand-300">01</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Agents</p>
            <p className="mt-2 text-2xl font-semibold text-brand-300">AI</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">Live</p>
          </div>
        </div>
      </div>
    </main>
  );
}
