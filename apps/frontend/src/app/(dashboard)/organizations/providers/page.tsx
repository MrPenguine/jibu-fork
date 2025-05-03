import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Providers",
  description: "Manage your API providers",
};

export default function ProvidersPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">Providers</h1>
      <p className="text-muted-foreground">
        This page will be implemented later to manage provider configurations.
      </p>
    </div>
  );
}