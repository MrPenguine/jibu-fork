import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PlayIcon, PlusCircleIcon, KeyIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Label } from '../../../components/ui/label';
import { useCredentials } from '../../../hooks/useCredentials';
import { CredentialModal } from '../credentials/CredentialModal';

export interface IntegrationNodeData {
  label: string;
  blockNumber: number;
  integrationType: string;
  credentialId?: string;
  operation?: string;
  parameters?: Record<string, any>;
  onTest?: (nodeId: string) => void;
}

export function IntegrationNode({ id, data, selected }: NodeProps<IntegrationNodeData>) {
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<string | undefined>(data.credentialId);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const { credentials, loading, fetchCredentials, testCredential } = useCredentials();

  // Fetch credentials on mount
  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Get credentials for this integration type
  const availableCredentials = credentials[data.integrationType] || [];

  const handleTest = async () => {
    if (!selectedCredential || !data.onTest) return;
    
    try {
      setTestStatus('testing');
      await testCredential(selectedCredential);
      data.onTest(id);
      setTestStatus('success');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setTestStatus('idle');
      }, 3000);
    } catch (err) {
      console.error('Credential test failed:', err);
      setTestStatus('error');
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setTestStatus('idle');
      }, 3000);
    }
  };

  const handleCredentialSave = (credentialId: string) => {
    setSelectedCredential(credentialId);
    setShowCredentialModal(false);
    // Refresh credentials list
    fetchCredentials();
  };

  // Determine the color scheme based on the integration type
  const colorScheme = 'blue'; // Default for integration nodes

  return (
    <div className={`border rounded-md ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Node header */}
      <div className={`flex items-center justify-between px-3 py-2 bg-${colorScheme}-50 border-b border-${colorScheme}-200 rounded-t-md`}>
        <div className="flex items-center">
          <span className={`text-sm font-medium text-${colorScheme}-700`}>
            New Block {data.blockNumber}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`h-6 w-6 p-0 text-${colorScheme}-700`}
          onClick={() => data.onTest?.(id)}
        >
          <PlayIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Node content */}
      <div className="bg-white p-3">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center">
            <div className={`p-2 rounded-md bg-${colorScheme}-100 mr-2`}>
              <KeyIcon className={`h-5 w-5 text-${colorScheme}-600`} />
            </div>
            <div>
              <h4 className="text-sm font-medium">{data.label}</h4>
              <p className="text-xs text-gray-500">{data.integrationType}</p>
            </div>
          </div>

          {/* Credential selection */}
          <div className="space-y-2">
            <Label htmlFor={`credential-${id}`} className="text-xs">
              Credential
            </Label>
            <div className="flex space-x-2">
              <Select
                value={selectedCredential}
                onValueChange={setSelectedCredential}
                disabled={loading}
              >
                <SelectTrigger id={`credential-${id}`} className="flex-1 text-xs h-8">
                  <SelectValue placeholder="Select credential" />
                </SelectTrigger>
                <SelectContent>
                  {availableCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={cred.id} className="text-xs">
                      {cred.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setShowCredentialModal(true)}
              >
                <PlusCircleIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={handleTest}
                disabled={!selectedCredential || testStatus === 'testing'}
              >
                {testStatus === 'idle' && 'Test'}
                {testStatus === 'testing' && 'Testing...'}
                {testStatus === 'success' && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
                {testStatus === 'error' && <XCircleIcon className="h-4 w-4 text-red-500" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className={`w-3 h-3 bg-${colorScheme}-500`}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`w-3 h-3 bg-${colorScheme}-500`}
      />

      {/* Credential Modal */}
      {showCredentialModal && (
        <CredentialModal
          credentialType={data.integrationType}
          onSave={handleCredentialSave}
          onCancel={() => setShowCredentialModal(false)}
        />
      )}
    </div>
  );
}
