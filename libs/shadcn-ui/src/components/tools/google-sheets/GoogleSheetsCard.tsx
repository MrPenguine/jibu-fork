"use client"

import { useState, useEffect } from 'react';
import { FileSpreadsheet, ExternalLink, Plus, Check, X, Loader2, Table, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { 
  getGoogleSheetsAuthUrl, 
  getGoogleSheetsStatus, 
  createGoogleSpreadsheet, 
  createGoogleSheetsTestSpreadsheet,
  appendToGoogleSheet
} from '../../../../../../apps/frontend/src/utils/toolsApi';

export function GoogleSheetsCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
  } | null>(null);
  
  // Tool configuration state
  const [toolName, setToolName] = useState('google_sheets_tool');
  const [toolDescription, setToolDescription] = useState('A tool to append data to Google Sheets spreadsheets');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A:Z');
  const [messages, setMessages] = useState<{id: string, text: string, stage: string}[]>([]);
  const [descriptionLength, setDescriptionLength] = useState(0);
  const [toolConfig, setToolConfig] = useState<{
    name: string;
    description: string;
    spreadsheetId: string;
    range: string;
    messages: {id: string, text: string, stage: string}[];
  } | null>(null);
  
  // Spreadsheet creation state
  const [showSpreadsheetForm, setShowSpreadsheetForm] = useState(false);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('');
  const [sheetNames, setSheetNames] = useState('Sheet1,Sheet2');
  
  // Update description length when description changes
  useEffect(() => {
    setDescriptionLength(toolDescription.length);
  }, [toolDescription]);

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const statusData = await getGoogleSheetsStatus();
      setStatus({
        connected: statusData.connected,
        clientIdConfigured: statusData.clientIdConfigured,
        clientSecretConfigured: statusData.clientSecretConfigured
      });
    } catch (err) {
      setError('Failed to check Google Sheets connection status');
      console.error('Error checking Google Sheets status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const saveToolConfiguration = () => {
    // Validate required fields
    if (!spreadsheetId) {
      setError('Spreadsheet ID is required');
      return;
    }
    
    if (!range) {
      setError('Range is required');
      return;
    }
    
    // Save the configuration
    const config = {
      name: toolName,
      description: toolDescription,
      spreadsheetId,
      range,
      messages
    };
    
    setToolConfig(config);
    setSuccess('Tool configuration saved successfully');
    
    // Store in localStorage for persistence
    localStorage.setItem('googleSheetsToolConfig', JSON.stringify(config));
  };
  
  // Load saved configuration on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('googleSheetsToolConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setToolName(config.name || 'google_sheets_tool');
        setToolDescription(config.description || 'A tool to append data to Google Sheets spreadsheets');
        setSpreadsheetId(config.spreadsheetId || '');
        setRange(config.range || 'Sheet1!A:Z');
        setMessages(config.messages || []);
        setToolConfig(config);
      } catch (err) {
        console.error('Error parsing saved Google Sheets tool configuration:', err);
      }
    }
  }, []);
  
  // Check status on component mount and load from localStorage
  useEffect(() => {
    // Check if token exists in localStorage
    const storedStatus = localStorage.getItem('googleSheetsStatus');
    if (storedStatus) {
      try {
        const parsedStatus = JSON.parse(storedStatus);
        setStatus(parsedStatus);
      } catch (err) {
        console.error('Error parsing stored Google Sheets status:', err);
        // If there's an error parsing, check status from server
        checkStatus();
      }
    } else {
      // If no stored status, check from server
      checkStatus();
    }
  }, []);
  
  // Save status to localStorage whenever it changes
  useEffect(() => {
    if (status) {
      localStorage.setItem('googleSheetsStatus', JSON.stringify(status));
    }
  }, [status]);

  const connectToGoogle = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const authUrl = await getGoogleSheetsAuthUrl();
      window.open(authUrl, '_blank');
    } catch (err) {
      setError('Failed to get Google Sheets authorization URL');
      console.error('Error getting Google Sheets auth URL:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateSpreadsheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate inputs
      if (!spreadsheetTitle) {
        throw new Error('Please provide a title for the spreadsheet');
      }
      
      // Parse sheet names from comma-separated string
      const sheetsArray = sheetNames
        ? sheetNames.split(',').map(name => ({ title: name.trim() }))
        : [{ title: 'Sheet1' }];
      
      // Create the spreadsheet
      const spreadsheetData = {
        title: spreadsheetTitle,
        sheets: sheetsArray
      };
      
      const createdSpreadsheet = await createGoogleSpreadsheet(spreadsheetData);
      
      // Reset form
      setSpreadsheetTitle('');
      setSheetNames('Sheet1,Sheet2');
      setShowSpreadsheetForm(false);
      
      setSuccess(`Spreadsheet "${createdSpreadsheet.properties.title}" created successfully!`);
    } catch (err) {
      setError(`Failed to create spreadsheet: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error creating spreadsheet:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setSpreadsheetTitle('');
    setSheetNames('Sheet1,Sheet2');
    setShowSpreadsheetForm(false);
  };
  
  const addMessage = () => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      text: '',
      stage: 'start' // Default stage
    };
    
    setMessages([...messages, newMessage]);
  };
  
  const updateMessage = (id: string, field: 'text' | 'stage', value: string) => {
    setMessages(messages.map(msg => 
      msg.id === id ? { ...msg, [field]: value } : msg
    ));
  };
  
  const removeMessage = (id: string) => {
    setMessages(messages.filter(msg => msg.id !== id));
  };
  
  // Function to test appending data to a spreadsheet
  const testAppendToSheet = async () => {
    if (!spreadsheetId || !range) {
      setError('Spreadsheet ID and Range are required');
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Create some test data to append
      const testData = [
        [`Test data from Jibu Console - ${new Date().toLocaleString()}`],
        ['This is a test row'],
        ['Another test row with multiple columns', 'Column 2', 'Column 3']
      ];
      
      const result = await appendToGoogleSheet(spreadsheetId, range, testData);
      
      setSuccess(`Successfully appended test data to ${result.updatedRange}`);
    } catch (err) {
      setError(`Failed to append data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error appending to Google Sheet:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const createTestSpreadsheet = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const createdSpreadsheet = await createGoogleSheetsTestSpreadsheet();
      setSuccess(`Test spreadsheet "${createdSpreadsheet.title}" created successfully!`);
    } catch (err) {
      setError(`Failed to create test spreadsheet: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error creating test spreadsheet:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="tool-name">Tool Name</Label>
              <Input
                id="tool-name"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tool-description">Description</Label>
              <div className="flex justify-end text-xs text-gray-500 mt-1">
                <span>{descriptionLength}/1000</span>
              </div>
              <Textarea
                id="tool-description"
                value={toolDescription}
                onChange={(e) => setToolDescription(e.target.value)}
                placeholder="Describe the tool in a few sentences"
                className="min-h-[100px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Google Sheets Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Metadata</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="spreadsheet-id" className="flex items-center">
                    Spreadsheet ID <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="spreadsheet-id"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="Enter Spreadsheet ID"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">The ID of the Google Sheet to append data to</p>
                </div>

                <div>
                  <Label htmlFor="range" className="flex items-center">
                    Range <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Input
                    id="range"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    placeholder="Enter Range (e.g., Sheet1!A:Z)"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">The range where the data should be appended (e.g., Sheet1, Sheet1!A:Z)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Messages</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-1"
            onClick={addMessage}
          >
            <PlusCircle className="h-4 w-4" /> Add Message
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Configure messages to be spoken during different stages of tool execution</p>
          
          {messages.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-md p-6 text-center text-gray-500">
              No messages configured. Click "Add Message" to add your first message.
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-2">
                    <select 
                      className="border rounded px-2 py-1 text-sm"
                      value={message.stage}
                      onChange={(e) => updateMessage(message.id, 'stage', e.target.value)}
                    >
                      <option value="start">Start</option>
                      <option value="processing">Processing</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeMessage(message.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={message.text}
                    onChange={(e) => updateMessage(message.id, 'text', e.target.value)}
                    placeholder="Enter message text"
                    className="mt-1 w-full"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!status?.connected && (
        <Card className="w-full bg-gray-50">
          <CardContent className="pt-6">
            <div className="py-4 flex flex-col items-center">
              <div className="text-center mb-6">
                <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <h3 className="text-lg font-medium">Connect to Google Sheets</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Connect your Google account to use Google Sheets with this tool.
                </p>
              </div>
              
              <Button 
                onClick={connectToGoogle} 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Connect Google Sheets
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="flex justify-between mt-6">
        <Button 
          variant="outline" 
          onClick={checkStatus}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Refresh Status
        </Button>
        
        <div className="space-x-2">
          {status?.connected && (
            <Button 
              variant="outline" 
              onClick={testAppendToSheet}
              disabled={loading || !spreadsheetId || !range}
              className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Table className="h-4 w-4 mr-2" />}
              Test Append
            </Button>
          )}
          
          <Button 
            onClick={saveToolConfiguration}
            disabled={loading || !spreadsheetId || !range}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Save Configuration
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GoogleSheetsCard;
