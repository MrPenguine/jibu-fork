import { redirect } from 'next/navigation';

export default async function AgentInterfacesIndex({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return redirect(`/agent/${agentId}/interfaces/widget`);
}
