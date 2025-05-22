"use client"

import { useState, useEffect } from 'react';
import { CalendarIcon, ExternalLink, Plus, Check, X, Loader2 } from 'lucide-react';
import { toast } from '../../ui/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { getGoogleCalendarAuthUrl, getGoogleCalendarStatus, createGoogleCalendarEvent, createGoogleCalendarTestEvent } from '../../../../../../apps/frontend/src/utils/toolsApi';

export function GoogleCalendarCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    clientIdConfigured: boolean;
    clientSecretConfigured: boolean;
  } | null>(null);
  
  // Event creation state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventAttendees, setEventAttendees] = useState('');
  const [eventTimeZone, setEventTimeZone] = useState('UTC');

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const statusData = await getGoogleCalendarStatus();
      setStatus({
        connected: statusData.connected,
        clientIdConfigured: statusData.clientIdConfigured,
        clientSecretConfigured: statusData.clientSecretConfigured
      });
    } catch (err) {
      setError('Failed to check Google Calendar connection status');
      console.error('Error checking Google Calendar status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Check status on component mount and load from localStorage
  useEffect(() => {
    // Check if token exists in localStorage
    const storedStatus = localStorage.getItem('googleCalendarStatus');
    if (storedStatus) {
      try {
        const parsedStatus = JSON.parse(storedStatus);
        setStatus(parsedStatus);
      } catch (err) {
        console.error('Error parsing stored Google Calendar status:', err);
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
      localStorage.setItem('googleCalendarStatus', JSON.stringify(status));
    }
  }, [status]);

  // Add event listener for messages from the OAuth popup window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if the message is from our OAuth callback
      if (event.data && event.data.type === 'GOOGLE_CALENDAR_CONNECTED') {
        console.log('Received connection success message from OAuth window');
        // Refresh the connection status immediately
        getGoogleCalendarStatus().then(newStatus => {
          setStatus(newStatus);
          if (newStatus.connected) {
            setSuccess('Google Calendar connected successfully!');
          }
          setLoading(false);
        }).catch(error => {
          console.error('Error refreshing connection status:', error);
          setLoading(false);
        });
      }
    };

    // Add the event listener
    window.addEventListener('message', handleMessage);

    // Clean up the event listener when the component unmounts
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const connectToGoogle = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const authUrl = await getGoogleCalendarAuthUrl();
      
      // Open the auth URL in a popup window
      const popup = window.open(authUrl, 'Google Calendar Authorization', 'width=600,height=600');
      
      if (!popup) {
        setError('Popup blocked. Please allow popups for this site.');
        setLoading(false);
        return;
      }
      
      // Set up event listener for messages from the popup window
      const messageHandler = async (event: MessageEvent) => {
        // Validate the origin of the message (optional security measure)
        // if (event.origin !== window.location.origin) return;
        
        console.log('Received message from popup:', event.data);
        
        if (event.data?.type === 'GOOGLE_CALENDAR_CONNECTED' && event.data?.success) {
          console.log('Google Calendar connected successfully!');
          
          // Remove the event listener
          window.removeEventListener('message', messageHandler);
          
          // Refresh the connection status
          try {
            const status = await getGoogleCalendarStatus();
            setStatus(status);
            setLoading(false);
            setSuccess('Successfully connected to Google Calendar!');
          } catch (error) {
            console.error('Error refreshing connection status:', error);
            setLoading(false);
            setError('Connected, but failed to refresh status');
          }
        }
      };
      
      // Add event listener for messages from the popup
      window.addEventListener('message', messageHandler);
      
      // Poll for connection status as a fallback
      const checkInterval = setInterval(async () => {
        try {
          const status = await getGoogleCalendarStatus();
          
          if (status.connected) {
            clearInterval(checkInterval);
            window.removeEventListener('message', messageHandler);
            setStatus(status);
            setLoading(false);
            setSuccess('Successfully connected to Google Calendar!');
            
            // Close the popup if it's still open
            if (!popup.closed) {
              popup.close();
            }
          }
        } catch (error) {
          console.error('Error checking connection status:', error);
        }
      }, 5000); // Check every 5 seconds
      
      // Stop checking after 2 minutes (timeout)
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', messageHandler);
        if (loading) {
          setLoading(false);
          setError('Connection timeout. Please try again.');
        }
      }, 120000);
      
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      setError('Failed to connect to Google Calendar');
      setLoading(false);
    }
  };
  
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate inputs
      if (!eventTitle || !eventStart || !eventEnd) {
        throw new Error('Please fill in all required fields');
      }
      
      // Parse attendees from comma-separated string
      const attendeesArray = eventAttendees
        ? eventAttendees.split(',').map(email => email.trim())
        : [];
      
      // Create the event
      const eventData = {
        title: eventTitle,
        description: eventDescription,
        startTime: eventStart,
        endTime: eventEnd,
        timeZone: eventTimeZone,
        attendees: attendeesArray
      };
      
      const createdEvent = await createGoogleCalendarEvent(eventData);
      
      // Reset form
      setEventTitle('');
      setEventDescription('');
      setEventStart('');
      setEventEnd('');
      setEventAttendees('');
      setShowEventForm(false);
      
      setSuccess(`Event "${createdEvent.summary}" created successfully!`);
    } catch (err) {
      setError(`Failed to create event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error creating event:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setEventTitle('');
    setEventDescription('');
    setEventStart('');
    setEventEnd('');
    setEventAttendees('');
    setShowEventForm(false);
  };
  
  const createTestEvent = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const createdEvent = await createGoogleCalendarTestEvent();
      setSuccess(`Test event "${createdEvent.summary}" created successfully!`);
    } catch (err) {
      setError(`Failed to create test event: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error creating test event:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-cyan-50 dark:bg-cyan-900/20 border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-cyan-500" />
          <CardTitle>Google Calendar</CardTitle>
        </div>
        <CardDescription>
          Check availability and schedule events in Google Calendar
        </CardDescription>
      </CardHeader>
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

        {/* Configuration warnings hidden since the backend has the correct environment variables */}

        {status?.connected ? (
          <div className="py-2">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
              <div className="h-3 w-3 rounded-full bg-green-600"></div>
              <span>Connected to Google Calendar</span>
            </div>
            
            {!showEventForm ? (
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowEventForm(true)} 
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Event
                </Button>
                <Button 
                  onClick={createTestEvent} 
                  className="w-full"
                  variant="secondary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Test Event (1 hour from now)
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreateEvent} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="event-title">Event Title *</Label>
                  <Input
                    id="event-title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Meeting with Team"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Discuss project updates"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-start">Start Time *</Label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      value={eventStart}
                      onChange={(e) => setEventStart(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="event-end">End Time *</Label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      value={eventEnd}
                      onChange={(e) => setEventEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="event-attendees">Attendees (comma-separated emails)</Label>
                  <Input
                    id="event-attendees"
                    value={eventAttendees}
                    onChange={(e) => setEventAttendees(e.target.value)}
                    placeholder="john@example.com, jane@example.com"
                  />
                </div>
                
                <div className="flex justify-between mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                    disabled={loading}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Create Event
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="flex items-center justify-center gap-2 text-gray-600 mb-4">
              <div className="h-3 w-3 rounded-full bg-gray-400"></div>
              <span>Not connected to Google Calendar</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" onClick={checkStatus} disabled={loading}>
          Check Status
        </Button>
        {!status?.connected ? (
          <Button onClick={connectToGoogle} disabled={loading}>
            {loading ? 'Loading...' : 'Connect'}
          </Button>
        ) : (
          <Button variant="outline" onClick={checkStatus} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default GoogleCalendarCard;
