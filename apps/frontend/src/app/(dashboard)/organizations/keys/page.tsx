import { Metadata } from "next";
import { ProvidersWrapper } from "./client-page";

export const metadata: Metadata = {
  title: "API Keys",
  description: "Manage your API provider keys and credentials",
};

export default function KeysPage() {
  return (
    <div className="w-full">
      <div className="sticky top-0 bg-background z-10 py-2 border-b mb-2">
        <h1 className="text-2xl font-bold">API Keys</h1>
      </div>
      <div className="w-full">
        <ProvidersWrapper />
      </div>
    </div>
  );
}
