"use client";

import { useState } from "react";
import { Card } from "@libs/shadcn-ui/components/ui/card";
import { Button } from "@libs/shadcn-ui/components/ui/button";
import { Badge } from "@libs/shadcn-ui/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@libs/shadcn-ui/components/ui/dialog";
import { Input } from "@libs/shadcn-ui/components/ui/input";
import { Label } from "@libs/shadcn-ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@libs/shadcn-ui/components/ui/select";
import { 
  Plus, 
  Eye, 
  EyeOff, 
  Edit, 
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";

// Mock data
const mockCredentials = [
  {
    id: "1",
    provider: "openai",
    name: "Jibu OpenAI Production",
    isActive: true,
    createdAt: "2024-01-15",
    lastUsed: "2 hours ago",
  },
  {
    id: "2",
    provider: "google-gemini",
    name: "Jibu Gemini Pro",
    isActive: true,
    createdAt: "2024-01-20",
    lastUsed: "5 minutes ago",
  },
  {
    id: "3",
    provider: "anthropic",
    name: "Jibu Claude Production",
    isActive: true,
    createdAt: "2024-02-01",
    lastUsed: "1 hour ago",
  },
  {
    id: "4",
    provider: "elevenlabs",
    name: "Jibu ElevenLabs TTS",
    isActive: false,
    createdAt: "2024-01-10",
    lastUsed: "3 days ago",
  },
];

const providers = [
  { value: "openai", label: "OpenAI", icon: "🤖" },
  { value: "google-gemini", label: "Google Gemini", icon: "✨" },
  { value: "anthropic", label: "Anthropic (Claude)", icon: "🧠" },
  { value: "azure-openai", label: "Azure OpenAI", icon: "☁️" },
  { value: "elevenlabs", label: "ElevenLabs", icon: "🔊" },
  { value: "twilio", label: "Twilio", icon: "📞" },
];

function ProviderBadge({ provider }: { provider: string }) {
  const providerConfig = providers.find(p => p.value === provider);
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{providerConfig?.icon}</span>
      <span className="font-medium">{providerConfig?.label || provider}</span>
    </div>
  );
}

export default function CredentialsPage() {
  const [showKey, setShowKey] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Credentials</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage API keys for third-party services used across all workspaces
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Platform Credential</DialogTitle>
              <DialogDescription>
                Add a new API key for a third-party service. This will be used by all client workspaces.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <span className="flex items-center gap-2">
                          <span>{provider.icon}</span>
                          <span>{provider.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Credential Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Jibu OpenAI Production"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-violet-600 hover:bg-violet-700">
                Create Credential
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Credentials Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  API Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockCredentials.map((credential) => (
                <tr key={credential.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ProviderBadge provider={credential.provider} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{credential.name}</div>
                    <div className="text-xs text-gray-500">Created {credential.createdAt}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {showKey === credential.id ? "sk-1234567890abcdef..." : "••••••••••••••••"}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowKey(showKey === credential.id ? null : credential.id)}
                      >
                        {showKey === credential.id ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {credential.isActive ? (
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-700 border-0">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {credential.lastUsed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">About Platform Credentials</h4>
            <p className="text-sm text-blue-700 mt-1">
              These credentials are shared across all client workspaces. When you publish an n8n workflow, 
              it will automatically use the active credential for the selected LLM provider. Make sure to 
              keep these keys secure and rotate them regularly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
