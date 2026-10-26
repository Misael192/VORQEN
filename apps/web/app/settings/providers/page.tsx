import { AIConfigForm } from '../../../components/settings/AIConfigForm';

export const metadata = { title: 'Provedores de IA — VORQEN' };

/**
 * Fase 2 (UI Web): Configurações -> Provedores de IA.
 * Server Component mínimo; toda a lógica de conexão é client-side
 * e fala direto com http://localhost:11434 via @vorqen/ai-core.
 */
export default function ProvidersSettingsPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      <AIConfigForm />
    </main>
  );
}
