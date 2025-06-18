"use client"

import { useState, useEffect } from 'react';
import { Code, ExternalLink, Plus, Check, X, Loader2 } from 'lucide-react';
import { toast } from '../../ui/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Switch } from '../../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  configureFunctionTool, 
  executeFunctionTool, 
  getFunctionToolStatus 
} from '../../../../../../apps/frontend/src/utils/toolsApi';

export function FunctionToolCard() {
  const [status, setStatus] = useState({
    configured: false,
    enabled: false,
    toolExists: false,
  });
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [toolName, setToolName] = useState('function-tool');
  const [description, setDescription] = useState('Describe the tool in a few sentences');
  const [isAsync, setIsAsync] = useState(false);
  const [isStrict, setIsStrict] = useState(false);
  const [serverUrl, setServerUrl] = useState('https://api.example.com/function');
  const [serverToken, setServerToken] = useState('');
  const [timeout, setTimeout] = useState(20);
  const [parameters, setParameters] = useState<Array<{name: string, type: string, description: string}>>([]);
  const [paramName, setParamName] = useState('');
  const [paramType, setParamType] = useState('string');
  const [paramDescription, setParamDescription] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionParams, setExecutionParams] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch the function tool status on component mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Fetch the status of the function tool
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const statusData = await getFunctionToolStatus();
      setStatus(statusData);
      
      if (statusData.configured) {
        // TODO: Fetch tool configuration and update state
        setSuccess('Function tool is configured and ready to use');
      }
    } catch (error) {
      console.error('Error fetching function tool status:', error);
      setError('Failed to fetch function tool status');
    } finally {
      setLoading(false);
    }
  };

  // Save the function tool configuration
  const saveConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const config = {
        name: toolName,
        description,
        enabled: true,
        function: {
          name: 'execute',
          parameters: parameters.reduce((acc, param) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
            };
            return acc;
          }, {} as Record<string, any>),
        },
        metadata: {
          async: isAsync,
          strict: isStrict,
          serverUrl,
          serverToken,
          timeout,
        },
      };
      
      await configureFunctionTool(config);
      
      setSuccess('Function tool configured successfully');
      fetchStatus();
    } catch (error) {
      console.error('Error configuring function tool:', error);
      setError('Failed to configure function tool');
    } finally {
      setLoading(false);
    }
  };

  // Add a parameter to the parameters list
  const addParameter = () => {
    if (!paramName) {
      toast({
        title: "Error",
        description: "Parameter name is required",
        variant: "destructive",
      });
      return;
    }
    
    setParameters([
      ...parameters,
      {
        name: paramName,
        type: paramType,
        description: paramDescription,
      },
    ]);
    
    // Reset parameter form
    setParamName('');
    setParamType('string');
    setParamDescription('');
  };

  // Remove a parameter from the parameters list
  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  // Execute the function with the provided parameters
  const executeFunction = async () => {
    try {
      setExecuting(true);
      setExecutionResult(null);
      setExecutionError(null);
      setError(null);
      setSuccess(null);
      
      const result = await executeFunctionTool(executionParams);
      
      setExecutionResult(result);
      setSuccess('Function executed successfully');
    } catch (error) {
      console.error('Error executing function:', error);
      setExecutionError(error instanceof Error ? error.message : 'Unknown error');
      setError('Failed to execute function');
    } finally {
      setExecuting(false);
    }
  };

  // Update a parameter in the execution parameters
  const updateExecutionParam = (name: string, value: any) => {
    setExecutionParams({
      ...executionParams,
      [name]: value,
    });
  };

  // Handle webhook test
  const testWebhook = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Create a test payload to send to the webhook
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from the function tool',
        },
      };
      
      // Use the execute function to test the webhook
      const result = await executeFunctionTool(testPayload);
      
      setExecutionResult(result);
      setSuccess('Webhook test sent successfully');
    } catch (error) {
      console.error('Error testing webhook:', error);
      setError('Failed to test webhook');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <Tabs defaultValue="settings">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Function Tool</CardTitle>
            <TabsList>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="execute">Execute</TabsTrigger>
              <TabsTrigger value="webhook">Webhook</TabsTrigger>
            </TabsList>
          </div>
          <CardDescription>Configure and execute custom functions</CardDescription>
        </CardHeader>
        
        <TabsContent value="settings">
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tool-name">Tool Name</Label>
                <Input
                  id="tool-name"
                  value={toolName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToolName(e.target.value)}
                  placeholder="Enter tool name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Describe the tool in a few sentences"
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="async">Async</Label>
                  <Switch
                    id="async"
                    checked={isAsync}
                    onCheckedChange={setIsAsync}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Tool executes asynchronously</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="strict">Strict</Label>
                  <Switch
                    id="strict"
                    checked={isStrict}
                    onCheckedChange={setIsStrict}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Enforces strict parameter validation</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="server-url">Server URL</Label>
                <Input
                  id="server-url"
                  value={serverUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerUrl(e.target.value)}
                  placeholder="https://api.example.com/function"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="server-token">Server Token</Label>
                <Input
                  id="server-token"
                  type="password"
                  value={serverToken}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerToken(e.target.value)}
                  placeholder="••••••••••••••••••"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  value={timeout}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeout(parseInt(e.target.value))}
                  min={1}
                  max={300}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Parameters</h3>
              <p className="text-sm text-muted-foreground">Enter the parameters your tool accepts.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="param-name">Name</Label>
                  <Input
                    id="param-name"
                    value={paramName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParamName(e.target.value)}
                    placeholder="Parameter name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="param-type">Type</Label>
                  <select
                    id="param-type"
                    value={paramType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParamType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="param-description">Description</Label>
                  <Input
                    id="param-description"
                    value={paramDescription}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setParamDescription(e.target.value)}
                    placeholder="Parameter description"
                  />
                </div>
              </div>
              
              <Button onClick={addParameter} variant="outline">Add Property</Button>
              
              {parameters.length > 0 && (
                <div className="border rounded-md p-4">
                  <h4 className="text-sm font-medium mb-2">Properties</h4>
                  <div className="space-y-2">
                    {parameters.map((param, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted p-2 rounded-md">
                        <div>
                          <span className="font-medium">{param.name}</span>
                          <span className="text-sm text-muted-foreground ml-2">({param.type})</span>
                          {param.description && (
                            <p className="text-xs text-muted-foreground">{param.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParameter(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          
          <CardFooter>
            <Button onClick={saveConfiguration} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="execute">
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            {!status.configured ? (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>Not Configured</AlertTitle>
                <AlertDescription>
                  Please configure the function tool in the Settings tab before executing.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertTitle>Ready to Execute</AlertTitle>
                  <AlertDescription>
                    The function tool is configured and ready to use.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Parameters</h3>
                  
                  {parameters.map((param, index) => (
                    <div key={index} className="space-y-2">
                      <Label htmlFor={`exec-param-${param.name}`}>{param.name}</Label>
                      {param.type === 'boolean' ? (
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`exec-param-${param.name}`}
                            checked={!!executionParams[param.name]}
                            onCheckedChange={(checked: boolean) => updateExecutionParam(param.name, checked)}
                          />
                          <Label htmlFor={`exec-param-${param.name}`}>
                            {executionParams[param.name] ? 'True' : 'False'}
                          </Label>
                        </div>
                      ) : param.type === 'object' || param.type === 'array' ? (
                        <Textarea
                          id={`exec-param-${param.name}`}
                          value={executionParams[param.name] ? JSON.stringify(executionParams[param.name], null, 2) : ''}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            try {
                              updateExecutionParam(param.name, JSON.parse(e.target.value));
                            } catch (error) {
                              // Allow invalid JSON during typing
                              updateExecutionParam(param.name, e.target.value);
                            }
                          }}
                          placeholder={`Enter ${param.type === 'object' ? '{}' : '[]'}`}
                          rows={4}
                        />
                      ) : (
                        <Input
                          id={`exec-param-${param.name}`}
                          type={param.type === 'number' ? 'number' : 'text'}
                          value={executionParams[param.name] || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateExecutionParam(param.name, e.target.value)}
                          placeholder={`Enter ${param.name}`}
                        />
                      )}
                      {param.description && (
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                {executionResult && (
                  <div className="border rounded-md p-4 bg-muted">
                    <h4 className="text-sm font-medium mb-2">Result</h4>
                    <pre className="text-xs overflow-auto p-2 bg-background rounded-md">
                      {JSON.stringify(executionResult, null, 2)}
                    </pre>
                  </div>
                )}
                
                {executionError && (
                  <Alert variant="destructive">
                    <X className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{executionError}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
          
          <CardFooter>
            <Button
              onClick={executeFunction}
              disabled={executing || !status.configured || parameters.length === 0}
            >
              {executing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                'Execute Function'
              )}
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="webhook">
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            {!status.configured ? (
              <Alert variant="destructive">
                <X className="h-4 w-4" />
                <AlertTitle>Not Configured</AlertTitle>
                <AlertDescription>
                  Please configure the function tool in the Settings tab before using webhooks.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Webhook Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Your function tool can receive external webhooks at the following URL:
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <Input
                      readOnly
                      value={`${serverUrl}/webhook`}
                      className="font-mono"
                    />
                    <Button variant="outline" size="icon" onClick={() => {
                      navigator.clipboard.writeText(`${serverUrl}/webhook`);
                      toast({
                        title: "Copied",
                        description: "Webhook URL copied to clipboard",
                      });
                    }}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Alert>
                    <Code className="h-4 w-4" />
                    <AlertTitle>Authentication</AlertTitle>
                    <AlertDescription>
                      Include your server token in the Authorization header:
                      <pre className="mt-2 bg-muted p-2 rounded-md text-xs overflow-auto">
                        Authorization: Bearer {serverToken || 'your-server-token'}
                      </pre>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <h4 className="text-md font-medium">Webhook Payload Format</h4>
                    <pre className="bg-muted p-3 rounded-md text-xs overflow-auto">
{`{
  "event": "string",  // Event type
  "timestamp": "string",  // ISO timestamp
  "data": {
    // Your payload data here
    // Must match the parameters defined in settings
  }
}`}
                    </pre>
                  </div>
                  
                  <Button onClick={testWebhook} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Webhook'
                    )}
                  </Button>
                  
                  {executionResult && (
                    <div className="border rounded-md p-4 bg-muted">
                      <h4 className="text-sm font-medium mb-2">Test Result</h4>
                      <pre className="text-xs overflow-auto p-2 bg-background rounded-md">
                        {JSON.stringify(executionResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

export default FunctionToolCard;
