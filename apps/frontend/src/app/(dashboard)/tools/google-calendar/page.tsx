'use client';

import { useState, useEffect } from 'react';
import { CalendarIcon, CheckCircle, XCircle, Plus } from 'lucide-react';

// Simple component replacements since we don't have access to the actual UI components
const Button = ({ children, onClick, disabled, className, variant }: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled} 
    className={`px-4 py-2 rounded ${className || ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const Card = ({ children, className }: any) => <div className={`border rounded-lg shadow-sm ${className || ''}`}>{children}</div>;
const CardHeader = ({ children }: any) => <div className="p-4 border-b">{children}</div>;
const CardTitle = ({ children, className }: any) => <h3 className={`text-lg font-semibold ${className || ''}`}>{children}</h3>;
const CardDescription = ({ children }: any) => <p className="text-sm text-gray-500">{children}</p>;
const CardContent = ({ children, className }: any) => <div className={`p-4 ${className || ''}`}>{children}</div>;
const CardFooter = ({ children }: any) => <div className="p-4 border-t">{children}</div>;
const Input = ({ id, value, onChange, placeholder }: any) => <input id={id} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-2 border rounded" />;
const Label = ({ htmlFor, children }: any) => <label htmlFor={htmlFor} className="block mb-1 font-medium">{children}</label>;
const Switch = ({ id, checked, onCheckedChange }: any) => (
  <div className="relative inline-block w-10 align-middle select-none">
    <input 
      type="checkbox" 
      id={id} 
      checked={checked} 
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange(e.target.checked)} 
      className="opacity-0 absolute w-full h-full cursor-pointer" 
    />
    <div className={`block w-10 h-6 rounded-full ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'transform translate-x-4' : ''}`}></div>
  </div>
);

export default function GoogleCalendarToolPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarId, setCalendarId] = useState('primary');
  const [checkAvailabilityEnabled, setCheckAvailabilityEnabled] = useState(true);
  const [createEventsEnabled, setCreateEventsEnabled] = useState(true);
  
  // Event creation form state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  
  // Debug state
  const [debugMessage, setDebugMessage] = useState('');
  const [eventAttendees, setEventAttendees] = useState('');
  const [createdEvent, setCreatedEvent] = useState<any>(null);

  useEffect(() => {
    // Check if the user has already connected their Google Calendar
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/v1/tools/google-calendar/status');
        if (response.ok) {
          const data = await response.json();
          setIsConnected(data.connected);
          if (data.settings) {
            setCalendarId(data.settings.calendarId || 'primary');
            setCheckAvailabilityEnabled(data.settings.checkAvailabilityEnabled !== false);
            setCreateEventsEnabled(data.settings.createEventsEnabled !== false);
          }
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    };

    checkConnection();
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Clear any existing connection state
      localStorage.removeItem('google-calendar-connected');
      localStorage.removeItem('google-calendar-tokens');
      
      console.log('Requesting Google Calendar authorization URL');
      const response = await fetch('/api/v1/tools/google-calendar/auth-url');
      
      if (!response.ok) {
        throw new Error(`Failed to get authorization URL: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received authorization URL');
      
      if (data.authUrl) {
        // Store the current timestamp to check for fresh tokens later
        localStorage.setItem('google-calendar-auth-request-time', Date.now().toString());
        
        // Redirect to Google OAuth
        console.log('Redirecting to Google OAuth page');
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL: No URL returned');
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      alert(`Error: Failed to connect to Google Calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/v1/tools/google-calendar/disconnect', {
        method: 'POST',
      });
      setIsConnected(false);
      console.log('Successfully disconnected from Google Calendar');
      alert('Successfully disconnected from Google Calendar');
    } catch (error) {
      console.error('Error disconnecting from Google Calendar:', error);
      alert('Error: Failed to disconnect from Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/v1/tools/google-calendar/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId,
          checkAvailabilityEnabled,
          createEventsEnabled,
        }),
      });
      
      console.log('Google Calendar settings saved');
      alert('Google Calendar settings saved');
    } catch (error) {
      console.error('Error saving Google Calendar settings:', error);
      alert('Error: Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate dates before proceeding
    if (!eventStart || !eventEnd) {
      alert('Please select both start and end dates');
      return;
    }
    
    // Validate that the dates are valid
    let startDate: Date;
    let endDate: Date;
    
    try {
      // Try to parse the date - handle different formats
      // First check if it's in DD/MM/YYYY format
      if (eventStart.includes('/')) {
        const [day, month, yearTime] = eventStart.split('/');
        const [year, time] = yearTime.split(' ');
        const [hours, minutes] = time.split(':');
        startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      } else {
        // Otherwise use standard parsing
        startDate = new Date(eventStart);
      }
      
      if (eventEnd.includes('/')) {
        const [day, month, yearTime] = eventEnd.split('/');
        const [year, time] = yearTime.split(' ');
        const [hours, minutes] = time.split(':');
        endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
      } else {
        // Otherwise use standard parsing
        endDate = new Date(eventEnd);
      }
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      console.error('Date parsing error:', error);
      alert('Please enter valid date and time values (format: DD/MM/YYYY HH:MM or YYYY-MM-DD HH:MM)');
      return;
    }
    
    setIsLoading(true);
    try {
      // Parse attendees from comma-separated string to array of email objects
      const attendeesList = eventAttendees
        .split(',')
        .map(email => email.trim())
        .filter(email => email)
        .map(email => ({ email }));
      
      const response = await fetch('/api/v1/tools/google-calendar/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: eventTitle,
          description: eventDescription,
          start: {
            dateTime: startDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          attendees: attendeesList,
          calendarId: calendarId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setCreatedEvent(data);
        // Reset form
        setEventTitle('');
        setEventDescription('');
        setEventStart('');
        setEventEnd('');
        setEventAttendees('');
        setShowEventForm(false);
        
        console.log('Event created successfully:', data.event);
        
        // Check if the event was created in mock mode
        if (data.message) {
          alert(`Event created successfully! Note: ${data.message}`);
        } else {
          alert('Event created successfully and pushed to Google Calendar!');
        }
      } else {
        throw new Error('Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Error: Failed to create event');
    } finally {
      setIsLoading(false);
    }
  };

  // Direct test function to diagnose Google Calendar integration issues
  const testGoogleCalendarIntegration = async () => {
    setDebugMessage('Starting Google Calendar integration test...');
    setIsLoading(true);
    
    try {
      // Create a test event with current time + 1 hour
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
      
      // Format the event data with very simple values for testing
      const testEventData = {
        summary: 'Test Event ' + now.toISOString().substring(0, 16),
        description: 'This is a test event created to diagnose Google Calendar integration issues',
        start: {
          dateTime: now.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: oneHourLater.toISOString(),
          timeZone: 'UTC',
        },
        attendees: [],
        calendarId: 'primary',
      };
      
      setDebugMessage(prev => prev + '\nPrepared test event data: ' + JSON.stringify(testEventData));
      
      // Call the API to create the event
      setDebugMessage(prev => prev + '\nSending request to create event...');
      const response = await fetch('/api/v1/tools/google-calendar/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testEventData),
      });
      
      setDebugMessage(prev => prev + `\nResponse status: ${response.status}`);
      
      // Get the response text regardless of status
      const responseText = await response.text();
      setDebugMessage(prev => prev + `\nResponse body: ${responseText}`);
      
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        setDebugMessage(prev => prev + '\nFailed to parse response as JSON');
      }
      
      if (response.ok && data) {
        setCreatedEvent(data);
        setDebugMessage(prev => prev + '\nSuccessfully created event! Event link: ' + (data.htmlLink || 'No link available'));
      } else {
        setDebugMessage(prev => prev + `\nError creating event: ${data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error in test function:', error);
      setDebugMessage(prev => prev + `\nException caught: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center mb-6">
        <CalendarIcon className="mr-2 h-6 w-6 text-cyan-500" />
        <h1 className="text-2xl font-bold">Google Calendar Tool</h1>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>
            Connect your Google Calendar to enable calendar features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-4">
            {isConnected ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium text-green-700">Connected to Google Calendar</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="font-medium text-red-700">Not connected to Google Calendar</span>
              </>
            )}
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <p className="mb-2">To connect to Google Calendar, you need to:</p>
            <ol className="list-decimal list-inside space-y-1 pl-2">
              <li>Click the Connect button below</li>
              <li>Sign in to your Google account</li>
              <li>Grant permission to access your calendar</li>
              <li>You'll be redirected back to this page</li>
            </ol>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> For this integration to work properly, make sure your Google account has the Calendar API enabled and the OAuth credentials are correctly configured.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          {isConnected ? (
            <Button 
              onClick={handleDisconnect}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Disconnect
            </Button>
          ) : (
            <Button 
              onClick={handleConnect}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Connect to Google Calendar
            </Button>
          )}
        </CardFooter>
      </Card>
      
      {isConnected && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Tool Settings</CardTitle>
              <CardDescription>
                Configure how the Google Calendar tool works with your assistant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="calendar-id">Default Calendar ID</Label>
                <Input 
                  id="calendar-id" 
                  value={calendarId} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCalendarId(e.target.value)}
                  placeholder="primary"
                />
                <p className="text-sm text-gray-500">
                  Leave as "primary" to use your main calendar, or enter a specific calendar ID.
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Capabilities</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="check-availability">Check Availability</Label>
                    <p className="text-sm text-gray-500">
                      Allow the assistant to check your calendar availability
                    </p>
                  </div>
                  <Switch
                    id="check-availability"
                    checked={checkAvailabilityEnabled}
                    onCheckedChange={setCheckAvailabilityEnabled}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="create-events">Create Events</Label>
                    <p className="text-sm text-gray-500">
                      Allow the assistant to create calendar events
                    </p>
                  </div>
                  <Switch
                    id="create-events"
                    checked={createEventsEnabled}
                    onCheckedChange={setCreateEventsEnabled}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveSettings} 
                disabled={isLoading}
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Event Creation Card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Calendar Events</CardTitle>
                  <CardDescription>
                    Create and manage events in your Google Calendar
                  </CardDescription>
                </div>
                {!showEventForm && (
                  <Button 
                    onClick={() => setShowEventForm(true)}
                    className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    <Plus className="mr-1 h-4 w-4" /> New Event
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showEventForm ? (
                <form onSubmit={handleCreateEvent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-title">Event Title</Label>
                    <Input
                      id="event-title"
                      value={eventTitle}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventTitle(e.target.value)}
                      placeholder="Meeting with Team"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="event-description">Description</Label>
                    <textarea
                      id="event-description"
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      placeholder="Discuss project updates"
                      className="w-full p-2 border rounded"
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event-start">Start Date & Time</Label>
                      <Input
                        id="event-start"
                        type="datetime-local"
                        value={eventStart}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventStart(e.target.value)}
                        required
                        placeholder="YYYY-MM-DD HH:MM"
                      />
                      <p className="text-xs text-gray-500">
                        Format: YYYY-MM-DD HH:MM (e.g., 2025-06-14 14:00)
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="event-end">End Date & Time</Label>
                      <Input
                        id="event-end"
                        type="datetime-local"
                        value={eventEnd}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventEnd(e.target.value)}
                        required
                        placeholder="YYYY-MM-DD HH:MM"
                      />
                      <p className="text-xs text-gray-500">
                        Format: YYYY-MM-DD HH:MM (e.g., 2025-06-14 14:30)
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="event-attendees">Attendees</Label>
                    <Input
                      id="event-attendees"
                      value={eventAttendees}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventAttendees(e.target.value)}
                      placeholder="email1@example.com, email2@example.com"
                    />
                    <p className="text-sm text-gray-500">
                      Enter email addresses separated by commas
                    </p>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="bg-cyan-500 hover:bg-cyan-600 text-white"
                    >
                      {isLoading ? 'Creating...' : 'Create Event'}
                    </Button>
                    
                    <Button
                      type="button"
                      onClick={() => setShowEventForm(false)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : createdEvent ? (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium mb-2">{createdEvent.summary}</h3>
                  {createdEvent.description && (
                    <p className="text-sm mb-2">{createdEvent.description}</p>
                  )}
                  <div className="text-sm text-gray-500">
                    {createdEvent.start?.dateTime && (
                      <p>Start: {new Date(createdEvent.start.dateTime).toLocaleString()}</p>
                    )}
                    {createdEvent.end?.dateTime && (
                      <p>End: {new Date(createdEvent.end.dateTime).toLocaleString()}</p>
                    )}
                    {createdEvent.attendees && createdEvent.attendees.length > 0 && (
                      <p>Attendees: {createdEvent.attendees.map((a: any) => a.email).join(', ')}</p>
                    )}
                  </div>
                  <div className="mt-3">
                    <a 
                      href={createdEvent.htmlLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-600 hover:text-cyan-800"
                    >
                      View in Google Calendar
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No events created yet. Click "New Event" to create one.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      
      {/* Debug Section */}
      <Card className="mt-6 border-orange-300">
        <CardHeader>
          <CardTitle>Debug Tools</CardTitle>
          <CardDescription>Use these tools to diagnose Google Calendar integration issues</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={testGoogleCalendarIntegration} 
            disabled={isLoading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Run Direct Calendar Test
          </Button>
          
          {debugMessage && (
            <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto max-h-96">
              <pre className="whitespace-pre-wrap">{debugMessage}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
