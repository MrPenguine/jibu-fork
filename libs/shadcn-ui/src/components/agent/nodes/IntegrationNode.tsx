import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Cog, Play } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { useN8nNodes, N8nNode, N8nNodeParameter } from '../../../hooks/useN8nNodes';
import { Spinner } from '../../ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Badge } from '../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';

interface IntegrationNodeProps {
  id: string;
  data: {
    label: string;
    nodeType?: string;
    parameters?: Record<string, any>;
    credentials?: Record<string, any>;
    onParameterChange?: (key: string, value: any) => void;
    onCredentialChange?: (key: string, value: any) => void;
    onNodeTypeChange?: (nodeType: string) => void;
    onTest?: () => void;
    blockNumber?: number;
  };
  selected: boolean;
}

export function IntegrationNode({ id, data, selected }: IntegrationNodeProps) {
  const { nodes, credentialTypes, loading, error, fetchNodeDetails, nodeDetails } = useN8nNodes();
  const [selectedNodeType, setSelectedNodeType] = useState<string | null>(data.nodeType || null);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<N8nNode | null>(null);
  const [parametersLoading, setParametersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('parameters');

  // Group nodes by category for easier selection
  const groupedNodes = useMemo(() => {
    if (!nodes) return {};
    
    const groups: Record<string, N8nNode[]> = {};
    
    nodes.forEach(node => {
      // Use the first group as the primary category
      const primaryGroup = (node.group && node.group.length > 0) ? node.group[0] : 'Other';
      
      if (!groups[primaryGroup]) {
        groups[primaryGroup] = [];
      }
      
      groups[primaryGroup].push(node);
    });
    
    return groups;
  }, [nodes]);

  // Load node details when node type changes
  useEffect(() => {
    if (!selectedNodeType) return;
    
    const loadNodeDetails = async () => {
      try {
        setParametersLoading(true);
        
        // Check if we already have the details cached
        if (nodeDetails[selectedNodeType]) {
          setSelectedNodeDetails(nodeDetails[selectedNodeType]);
        } else {
          // Fetch the details
          const details = await fetchNodeDetails(selectedNodeType);
          setSelectedNodeDetails(details);
        }
      } catch (error) {
        console.error('Error loading node details:', error);
      } finally {
        setParametersLoading(false);
      }
    };
    
    loadNodeDetails();
  }, [selectedNodeType, fetchNodeDetails, nodeDetails]);

  // Handle node type change
  const handleNodeTypeChange = (value: string) => {
    setSelectedNodeType(value);
    
    // Reset parameters when changing node type
    if (data.onNodeTypeChange) {
      data.onNodeTypeChange(value);
    }
  };

  // Handle parameter change
  const handleParameterChange = (key: string, value: any) => {
    if (data.onParameterChange) {
      data.onParameterChange(key, value);
    }
  };

  // Handle credential change
  const handleCredentialChange = (key: string, value: any) => {
    if (data.onCredentialChange) {
      data.onCredentialChange(key, value);
    }
  };

  // Render parameter input based on type
  const renderParameterInput = (param: N8nNodeParameter) => {
    const value = data.parameters?.[param.name] || param.default || '';
    
    switch (param.type) {
      case 'string':
        if (param.options) {
          return (
            <Select
              value={value}
              onValueChange={(val) => handleParameterChange(param.name, val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={param.placeholder || `Select ${param.displayName}`} />
              </SelectTrigger>
              <SelectContent>
                {param.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        } else {
          return (
            <Input
              type="text"
              value={value}
              placeholder={param.placeholder || ''}
              onChange={(e) => handleParameterChange(param.name, e.target.value)}
            />
          );
        }
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            placeholder={param.placeholder || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
          />
        );
      case 'boolean':
        return (
          <Select
            value={value ? 'true' : 'false'}
            onValueChange={(val) => handleParameterChange(param.name, val === 'true')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={param.placeholder || `Select ${param.displayName}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'json':
      case 'object':
        return (
          <Textarea
            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            placeholder={param.placeholder || '{}'}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleParameterChange(param.name, parsed);
              } catch (error) {
                // Allow invalid JSON during typing
                handleParameterChange(param.name, e.target.value);
              }
            }}
            className="min-h-[100px]"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            placeholder={param.placeholder || ''}
            onChange={(e) => handleParameterChange(param.name, e.target.value)}
          />
        );
    }
  };

  return (
    <div className={`rounded-md border border-blue-200 bg-white ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      {/* Node Header */}
      <div className="flex items-center justify-between bg-blue-50 p-2 rounded-t-md">
        <div className="flex items-center">
          <Cog className="h-4 w-4 text-blue-500 mr-2" />
          <span className="text-sm font-medium text-blue-700">
            {data.blockNumber ? `New Block ${data.blockNumber}` : 'Integration'}
          </span>
        </div>
        {data.onTest && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={data.onTest}
          >
            <Play className="h-4 w-4 text-blue-500" />
          </Button>
        )}
      </div>

      {/* Node Content */}
      <div className="p-3 bg-white">
        {loading ? (
          <div className="flex justify-center items-center py-4">
            <Spinner className="text-blue-500" />
            <span className="ml-2 text-sm text-blue-700">Loading nodes...</span>
          </div>
        ) : error ? (
          <div className="text-red-500 text-sm p-2">
            Error loading n8n nodes. Please try again.
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label htmlFor={`node-type-${id}`} className="text-xs text-gray-500 mb-1">
                Integration Type
              </Label>
              <Select
                value={selectedNodeType || ''}
                onValueChange={handleNodeTypeChange}
              >
                <SelectTrigger id={`node-type-${id}`} className="w-full">
                  <SelectValue placeholder="Select Integration Type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedNodes).map(([group, groupNodes]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                        {group}
                      </div>
                      {groupNodes.map((node) => (
                        <SelectItem key={node.name} value={node.name}>
                          {node.displayName}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedNodeType && (
              <>
                {parametersLoading ? (
                  <div className="flex justify-center items-center py-4">
                    <Spinner className="text-blue-500" />
                    <span className="ml-2 text-sm text-blue-700">Loading parameters...</span>
                  </div>
                ) : selectedNodeDetails ? (
                  <div className="space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="parameters">Parameters</TabsTrigger>
                        <TabsTrigger value="credentials">Credentials</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="parameters" className="space-y-4 pt-2">
                        {selectedNodeDetails.properties.length === 0 ? (
                          <div className="text-sm text-gray-500">No parameters required</div>
                        ) : (
                          <Accordion type="single" collapsible className="w-full">
                            {selectedNodeDetails.properties.map((param) => (
                              <AccordionItem key={param.name} value={param.name}>
                                <AccordionTrigger className="py-2">
                                  <div className="flex items-center">
                                    <span className="text-sm">{param.displayName}</span>
                                    {param.required && (
                                      <Badge variant="outline" className="ml-2 text-xs bg-red-50 text-red-700 border-red-200">
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-2">
                                    {param.description && (
                                      <p className="text-xs text-gray-500">{param.description}</p>
                                    )}
                                    {renderParameterInput(param)}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="credentials" className="space-y-4 pt-2">
                        {!selectedNodeDetails.credentials || selectedNodeDetails.credentials.length === 0 ? (
                          <div className="text-sm text-gray-500">No credentials required</div>
                        ) : (
                          <div className="space-y-4">
                            {selectedNodeDetails.credentials.map((cred) => (
                              <div key={cred.name} className="space-y-2">
                                <Label className="text-sm">
                                  {cred.name}
                                  {cred.required && (
                                    <Badge variant="outline" className="ml-2 text-xs bg-red-50 text-red-700 border-red-200">
                                      Required
                                    </Badge>
                                  )}
                                </Label>
                                <Select
                                  value={data.credentials?.[cred.name] || ''}
                                  onValueChange={(val) => handleCredentialChange(cred.name, val)}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder={`Select ${cred.name} credential`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="create-new">Create New Credential</SelectItem>
                                    {/* Credential options would be populated from API */}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No details available for this node type
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#3b82f6', width: '8px', height: '8px' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: '8px', height: '8px' }}
      />
    </div>
  );
}
