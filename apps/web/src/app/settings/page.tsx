import AIConfigForm from '@/components/AIConfigForm';

export const metadata = { title: 'Configuracoes de IA - VORQEN' };

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <AIConfigForm />
    </div>
  );
}
