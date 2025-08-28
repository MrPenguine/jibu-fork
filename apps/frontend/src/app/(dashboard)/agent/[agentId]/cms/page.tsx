import { redirect } from 'next/navigation';

export default async function AgentCmsIndex({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return redirect(`/agent/${agentId}/cms/workflows`);
}
