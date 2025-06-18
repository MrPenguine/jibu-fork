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
  configureMcpTool, 
  executeMcpTool, 
  getMcpToolStatus,
  listMcpResources,
  readMcpResource,
  discoverMcpTools
} from '../../../../../../apps/frontend/src/utils/toolsApi';

export function McpToolCard() {
  const [status, setStatus] = useState({
    configured: false,
    enabled: false,
    toolExists: false,
  });
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [toolName, setToolName] = useState('mcp-tool');
  const [description, setDescription] = useState('Connect to MCP servers for enhanced capabilities');
  const [serverUrl, setServerUrl] = useState('');
  const [serverToken, setServerToken] = useState('');
  const [timeout, setTimeout] = useState(30);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [executionParams, setExecutionParams] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [resourceCursor, setResourceCursor] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<any>(null);
  const [loadingResourceContent, setLoadingResourceContent] = useState(false);
  
  // State for the Tools tab
  const [tools, setTools] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);

  // Fetch the MCP tool status on component mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Fetch the status of the MCP tool
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await getMcpToolStatus().catch(err => {
        console.warn('Error fetching MCP tool status, using default values:', err);
        // Return default values if the API call fails
        return {
          configured: false,
          enabled: true,
          toolExists: true
        };
      });
      
      setStatus(response);
      
      if (response.configured) {
        // If the tool is configured, fetch its configuration
        const tool = await getMcpToolConfig();
        if (tool) {
          setToolName(tool.name || 'mcp-tool');
          setDescription(tool.description || 'Connect to MCP servers for enhanced capabilities');
          setServerUrl(tool.metadata?.serverUrl || '');
          setServerToken(tool.metadata?.serverToken || '');
          setTimeout(tool.metadata?.timeout || 30);
        }
      }
    } catch (err) {
      console.error('Error fetching MCP tool status:', err);
      // Don't show error to user, just log it
      console.warn('Using default MCP tool configuration for development');
    } finally {
      setLoading(false);
    }
  };

  // Get the MCP tool configuration
  const getMcpToolConfig = async () => {
    try {
      // This is a mock function since we don't have a specific endpoint for this
      // In a real implementation, you would have an API endpoint to get the tool configuration
      return {
        name: toolName,
        description: description,
        metadata: {
          serverUrl: serverUrl,
          serverToken: serverToken,
          timeout: timeout
        }
      };
    } catch (err) {
      console.error('Error fetching MCP tool configuration:', err);
      return null;
    }
  };

  // Configure the MCP tool
  const configureTool = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (!serverUrl) {
        setError('Server URL is required');
        setLoading(false);
        return;
      }

      const config = {
        name: toolName,
        description: description,
        serverUrl: serverUrl,
        serverToken: serverToken,
        timeout: timeout,
        enabled: true
      };

      await configureMcpTool(config);
      setSuccess('MCP tool configured successfully');
      await fetchStatus();
      toast({
        title: 'Success',
        description: 'MCP tool configured successfully',
      });
    } catch (err) {
      console.error('Error configuring MCP tool:', err);
      setError('Failed to configure MCP tool. Please check your settings and try again.');
      toast({
        title: 'Error',
        description: 'Failed to configure MCP tool',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Execute the MCP tool
  const executeTool = async () => {
    try {
      setExecuting(true);
      setExecutionError(null);
      setExecutionResult(null);

      const response = await executeMcpTool(executionParams);
      setExecutionResult(response);
      toast({
        title: 'Success',
        description: 'MCP tool executed successfully',
      });
    } catch (err) {
      console.error('Error executing MCP tool:', err);
      setExecutionError('Failed to execute MCP tool. Please check your parameters and try again.');
      toast({
        title: 'Error',
        description: 'Failed to execute MCP tool',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  // List resources from the MCP server
  const fetchResources = async () => {
    try {
      setLoadingResources(true);
      setError(null);

      if (!serverUrl) {
        setError('Server URL is required');
        setLoadingResources(false);
        return;
      }

      const response = await listMcpResources(serverUrl, serverToken, resourceCursor || undefined);
      setResources(response.resources || []);
      setResourceCursor(response.cursor || null);
      
      if (response.resources?.length === 0) {
        toast({
          title: 'Info',
          description: 'No resources found on the MCP server',
        });
      }
    } catch (err) {
      console.error('Error listing MCP resources:', err);
      setError('Failed to list MCP resources. Please check your server settings and try again.');
      toast({
        title: 'Error',
        description: 'Failed to list MCP resources',
        variant: 'destructive',
      });
    } finally {
      setLoadingResources(false);
    }
  };

  // Read a resource from the MCP server
  const readResource = async (resourceUri: string) => {
    try {
      setLoadingResourceContent(true);
      setError(null);

      if (!serverUrl) {
        setError('Server URL is required');
        setLoadingResourceContent(false);
        return;
      }

      if (!resourceUri) {
        setError('Resource URI is required');
        setLoadingResourceContent(false);
        return;
      }

      const response = await readMcpResource(serverUrl, resourceUri, serverToken);
      setResourceContent(response);
    } catch (err) {
      console.error('Error reading MCP resource:', err);
      setError('Failed to read MCP resource. Please check your server settings and try again.');
      toast({
        title: 'Error',
        description: 'Failed to read MCP resource',
        variant: 'destructive',
      });
    } finally {
      setLoadingResourceContent(false);
    }
  };
  
  // Discover tools from the MCP server
  const discoverTools = async () => {
    try {
      setLoadingTools(true);
      setError(null);
      setSelectedTool(null);

      if (!serverUrl) {
        setError('Server URL is required');
        setLoadingTools(false);
        return;
      }

      const response = await discoverMcpTools(serverUrl, serverToken);
      
      if (response.tools && Array.isArray(response.tools)) {
        setTools(response.tools);
        
        if (response.tools.length === 0) {
          toast({
            title: 'Info',
            description: 'No tools found on the MCP server',
          });
        }
      } else {
        // If the response doesn't have a tools array, try to extract tools from the raw response
        if (response.rawResponse) {
          const extractedTools = [];
          
          // Try to find tools in different possible formats
          if (response.rawResponse.tools && Array.isArray(response.rawResponse.tools)) {
            extractedTools.push(...response.rawResponse.tools);
          } else if (response.rawResponse.functions && Array.isArray(response.rawResponse.functions)) {
            extractedTools.push(...response.rawResponse.functions);
          } else if (Array.isArray(response.rawResponse)) {
            extractedTools.push(...response.rawResponse);
          }
          
          setTools(extractedTools);
          
          if (extractedTools.length === 0) {
            toast({
              title: 'Info',
              description: 'No tools found in the MCP server response',
            });
          }
        } else {
          setTools([]);
          toast({
            title: 'Info',
            description: 'No tools found in the MCP server response',
          });
        }
      }
    } catch (err) {
      console.error('Error discovering MCP tools:', err);
      setError('Failed to discover MCP tools. Please check your server settings and try again.');
      toast({
        title: 'Error',
        description: 'Failed to discover MCP tools',
        variant: 'destructive',
      });
    } finally {
      setLoadingTools(false);
    }
  };

  // Handle parameter input change
  const handleParamChange = (key: string, value: any) => {
    setExecutionParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Render the parameter input fields
  const renderParamInputs = () => {
    // If we have resource content, use its schema to generate parameter inputs
    if (resourceContent?.schema?.properties) {
      return Object.entries(resourceContent.schema.properties).map(([key, prop]: [string, any]) => (
        <div key={key} className="space-y-2 mb-4">
          <Label htmlFor={key}>{prop.title || key}{prop.required ? ' *' : ''}</Label>
          <Input
            id={key}
            placeholder={prop.description || `Enter ${key}`}
            value={executionParams[key] || ''}
            onChange={(e) => handleParamChange(key, e.target.value)}
          />
          {prop.description && (
            <p className="text-sm text-muted-foreground">{prop.description}</p>
          )}
        </div>
      ));
    }

    // Default parameter input if no schema is available
    return (
      <div className="space-y-2">
        <Label htmlFor="params">Parameters (JSON)</Label>
        <Textarea
          id="params"
          placeholder='{"key": "value"}'
          value={JSON.stringify(executionParams, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              setExecutionParams(parsed);
            } catch (err) {
              // Allow invalid JSON during typing
              // The execute button will validate before sending
            }
          }}
          className="min-h-[150px] font-mono"
        />
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>MCP Tool</CardTitle>
        <CardDescription>
          Connect to Model Context Protocol (MCP) servers for enhanced capabilities
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="settings">
          <TabsList className="mb-4">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>
          
          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toolName">Tool Name</Label>
              <Input
                id="toolName"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder="MCP Tool"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the tool in a few sentences"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://actions.zapier.com/mcp/actions/"
              />
              <p className="text-sm text-muted-foreground">
                The URL of your MCP server (e.g., from Zapier, Composio, or other MCP providers)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="serverToken">Server Token (Optional)</Label>
              <Input
                id="serverToken"
                type="password"
                value={serverToken}
                onChange={(e) => setServerToken(e.target.value)}
                placeholder="Enter your server token"
              />
              <p className="text-sm text-muted-foreground">
                Authentication token for your MCP server, if required
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(parseInt(e.target.value) || 30)}
                min={1}
                max={300}
              />
              <p className="text-sm text-muted-foreground">
                Maximum time to wait for a response from the MCP server
              </p>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={configureTool} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Configuration
                </>
              )}
            </Button>
          </TabsContent>
          
          {/* Execute Tab */}
          <TabsContent value="execute" className="space-y-4">
            {!status.configured ? (
              <Alert>
                <AlertTitle>Tool Not Configured</AlertTitle>
                <AlertDescription>
                  Please configure the MCP tool in the Settings tab before executing.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-4">
                  {renderParamInputs()}
                  
                  <Button 
                    onClick={executeTool} 
                    disabled={executing || !status.enabled}
                    className="w-full"
                  >
                    {executing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Code className="mr-2 h-4 w-4" />
                        Execute MCP Tool
                      </>
                    )}
                  </Button>
                </div>
                
                {executionError && (
                  <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{executionError}</AlertDescription>
                  </Alert>
                )}
                
                {executionResult && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-lg font-medium">Execution Result:</h3>
                    <pre className="bg-secondary p-4 rounded-md overflow-auto max-h-[300px]">
                      {JSON.stringify(executionResult, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-4">
            {!status.configured ? (
              <Alert>
                <AlertTitle>Tool Not Configured</AlertTitle>
                <AlertDescription>
                  Please configure the MCP tool in the Settings tab before viewing resources.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex space-x-2">
                  <Button 
                    onClick={fetchResources} 
                    disabled={loadingResources}
                    className="flex-1"
                  >
                    {loadingResources ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        List Resources
                      </>
                    )}
                  </Button>
                  
                  {resourceCursor && (
                    <Button 
                      onClick={fetchResources} 
                      disabled={loadingResources}
                      variant="outline"
                    >
                      Load More
                    </Button>
                  )}
                </div>
                
                {resources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-lg font-medium">Available Resources:</h3>
                    <div className="bg-secondary p-4 rounded-md overflow-auto max-h-[300px]">
                      <ul className="space-y-2">
                        {resources.map((resource, index) => (
                          <li key={index} className="flex items-center justify-between">
                            <span>{resource.name || resource.uri || `Resource ${index + 1}`}</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => readResource(resource.uri)}
                              disabled={loadingResourceContent && selectedResource === resource.uri}
                            >
                              {loadingResourceContent && selectedResource === resource.uri ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'View'
                              )}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                
                {resourceContent && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-lg font-medium">Resource Details:</h3>
                    <pre className="bg-secondary p-4 rounded-md overflow-auto max-h-[300px]">
                      {JSON.stringify(resourceContent, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools" className="space-y-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Available Tools</h3>
                <Button
                  onClick={discoverTools}
                  disabled={loadingTools || !serverUrl}
                >
                  {loadingTools ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Discovering...
                    </>
                  ) : (
                    <>Discover Tools</>
                  )}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!serverUrl && (
                <Alert>
                  <AlertTitle>Configuration Required</AlertTitle>
                  <AlertDescription>
                    Please configure the MCP tool with a server URL in the Settings tab before discovering tools.
                  </AlertDescription>
                </Alert>
              )}

              {tools.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {tools.map((tool, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {tool.name || tool.uri || `Tool ${index + 1}`}
                        </CardTitle>
                        {tool.description && (
                          <CardDescription className="line-clamp-2">
                            {tool.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex flex-col space-y-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTool(tool)}
                          >
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center">
                  <h3 className="font-medium">No Tools Found</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Discover Tools" to find available tools from the MCP server.
                  </p>
                </div>
              )}

              {selectedTool && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>
                      {selectedTool.name || selectedTool.uri || 'Tool Details'}
                    </CardTitle>
                    {selectedTool.description && (
                      <CardDescription>{selectedTool.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedTool.parameters && (
                        <div>
                          <h4 className="font-medium mb-2">Parameters</h4>
                          <div className="rounded-md bg-muted p-4">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(selectedTool.parameters, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {selectedTool.schema && (
                        <div>
                          <h4 className="font-medium mb-2">Schema</h4>
                          <div className="rounded-md bg-muted p-4">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(selectedTool.schema, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Prepare parameters based on the tool's schema
                          const params = {};
                          // Add the tool URI to the parameters for execution
                          setExecutionParams({
                            uri: selectedTool.uri || selectedTool.name,
                            params: params
                          });
                          // Switch to the Execute tab
                          const tabsElement = document.querySelector('[role="tablist"]');
                          const executeTab = tabsElement?.querySelector('[value="execute"]');
                          if (executeTab instanceof HTMLElement) {
                            executeTab.click();
                          }
                        }}
                      >
                        Use This Tool
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          {status.configured ? (
            <span className="flex items-center">
              <Check className="mr-1 h-4 w-4 text-green-500" />
              Configured
            </span>
          ) : (
            <span className="flex items-center">
              <X className="mr-1 h-4 w-4 text-red-500" />
              Not Configured
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {status.enabled ? (
            <span className="flex items-center">
              <Check className="mr-1 h-4 w-4 text-green-500" />
              Enabled
            </span>
          ) : (
            <span className="flex items-center">
              <X className="mr-1 h-4 w-4 text-red-500" />
              Disabled
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

export default McpToolCard;
