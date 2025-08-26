import { redirect } from 'next/navigation';

export default function AgentCmsIndex({ params }: { params: { agentId: string } }) {
  return redirect(`/agent/${params.agentId}/cms/workflows`);
}
