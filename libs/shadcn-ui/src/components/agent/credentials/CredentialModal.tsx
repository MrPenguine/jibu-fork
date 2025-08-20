import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Spinner } from '../../../components/ui/spinner';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { useCredentials } from '../../../hooks/useCredentials';

interface CredentialModalProps {
  credentialType: string;
  onSave: (credentialId: string) => void;
  onCancel: () => void;
}

export function CredentialModal({ credentialType, onSave, onCancel }: CredentialModalProps) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<any | null>(null);
  
  const { getCredentialSchema, createCredential } = useCredentials();
  
  // Fetch credential schema on mount
  useEffect(() => {
    const fetchSchema = async () => {
      try {
        setLoading(true);
        const schemaData = await getCredentialSchema(credentialType);
        setSchema(schemaData);
      } catch (err) {
        setError('Failed to load credential schema. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSchema();
  }, [credentialType, getCredentialSchema]);
  
  const handleFieldChange = (name: string, value: any) => {
    setFields(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSave = async () => {
    try {
      if (!name.trim()) {
        setError('Credential name is required');
        return;
      }
      
      // Validate required fields
      if (schema && schema.properties) {
        const requiredFields = schema.properties.filter((prop: any) => prop.required);
        for (const field of requiredFields) {
          if (!fields[field.name] && fields[field.name] !== false && fields[field.name] !== 0) {
            setError(`${field.displayName || field.name} is required`);
            return;
          }
        }
      }
      
      setSaving(true);
      setError(null);
      
      const result = await createCredential({
        name,
        type: credentialType,
        data: fields
      });
      
      onSave(result.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create credential');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create {schema?.displayName || credentialType} Credential</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Spinner className="text-blue-500" />
            <span className="ml-2">Loading credential schema...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="credential-name">Credential Name</Label>
              <Input
                id="credential-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My API Credential"
                disabled={saving}
              />
            </div>
            
            {schema?.properties?.map((prop: any) => (
              <div key={prop.name} className="space-y-2">
                <Label htmlFor={`credential-${prop.name}`}>
                  {prop.displayName || prop.name}
                  {prop.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id={`credential-${prop.name}`}
                  type={prop.type === 'password' ? 'password' : 'text'}
                  value={fields[prop.name] || ''}
                  onChange={(e) => handleFieldChange(prop.name, e.target.value)}
                  placeholder={prop.placeholder || ''}
                  disabled={saving}
                />
                {prop.description && (
                  <p className="text-xs text-gray-500">{prop.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              'Save Credential'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
