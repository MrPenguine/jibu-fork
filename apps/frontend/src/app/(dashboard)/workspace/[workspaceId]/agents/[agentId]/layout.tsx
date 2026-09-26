import { FloatingAgentTester } from "./FloatingAgentTester";

export default function AgentDetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingAgentTester />
    </>
  );
}
