import { redirect } from 'next/navigation';

export default function AgentSettingsIndex({ params }: { params: { agentId: string } }) {
  return redirect(`/agent/${params.agentId}/settings/general`);
}
