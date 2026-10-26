import { IDEWorkspace } from '../../../src/components/IDEWorkspace';

export default async function IdePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <IDEWorkspace projectId={projectId} />;
}
