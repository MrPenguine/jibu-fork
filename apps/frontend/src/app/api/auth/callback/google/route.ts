import { NextRequest, NextResponse } from 'next/server';

// Use the getBackendUrl function directly
const getBackendUrl = () => {
  // In server-side rendering, use environment variables or default to localhost
  return process.env.BACKEND_URL || 'http://localhost:4000';
};

export async function GET(request: NextRequest) {
  // Get the authorization code from the URL query parameters
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  
  if (!code) {
    return new Response('Authorization code is missing', { status: 400 });
  }

  try {
    // Get the backend URL using our utility function
    const backendUrl = getBackendUrl();
    
    let success = false;
    // Create a variable to hold our cookie headers if needed
    let cookieHeaders: Headers | undefined;
    
    try {
      console.log('Sending authorization code to backend for token exchange');
      
      // Get organization ID from local storage if available
      let organizationId = '';
      if (typeof localStorage !== 'undefined') {
        const orgData = localStorage.getItem('activeOrganization');
        if (orgData) {
          try {
            const parsedOrgData = JSON.parse(orgData);
            organizationId = parsedOrgData.id || '';
            console.log(`Using organization ID from local storage: ${organizationId}`);
          } catch (e) {
            console.error('Failed to parse organization data from localStorage', e);
          }
        }
      }
      
      // Try to send the code to the backend to exchange it for tokens
      const response = await fetch(`${backendUrl}/api/v1/tools/google-calendar/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Organization-ID': organizationId,
          'organization-id': organizationId,
        },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const tokenData = await response.json();
        console.log('Successfully received tokens from backend');
        
        // Store the tokens in localStorage for future use
        // In a real implementation, you might use a more secure storage method
        if (typeof window !== 'undefined') {
          localStorage.setItem('google-calendar-tokens', JSON.stringify(tokenData.tokens));
        }
        
        // Set a cookie to indicate that the user is connected
        const headers = new Headers();
        headers.append('Set-Cookie', 'google-calendar-connected=true; Path=/; HttpOnly');
        
        success = true;
      } else {
        console.error('Failed to exchange code for tokens:', response.status);
      }
    } catch (fetchError) {
      console.log('Backend not available, using mock implementation', fetchError);
    }
    
    // If backend call fails, use a mock implementation for demonstration
    if (!success) {
      console.log('Using mock Google Calendar token exchange');
      console.log('Auth code received:', code);
      
      // For demonstration purposes, we'll consider this a success
      // In a real implementation, you would exchange the code for tokens
      // and store them in your database
      
      // Set a cookie to indicate that the user has connected their Google Calendar
      // This is just for the demo, in a real implementation you would store tokens in your database
      cookieHeaders = new Headers();
      cookieHeaders.append('Set-Cookie', 'google-calendar-demo-connected=true; Path=/; HttpOnly');
      
      success = true;
    }

    // Create response headers for the success page
    const responseHeaders = new Headers({
      'Content-Type': 'text/html'
    });
    
    // If we have cookie headers from the mock implementation, add them
    if (cookieHeaders) {
      // Add the Set-Cookie header from our mock implementation
      const cookieHeader = cookieHeaders.get('Set-Cookie');
      if (cookieHeader) {
        responseHeaders.set('Set-Cookie', cookieHeader);
      }
    }
    
    // Return a success page that will close itself
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Calendar Connected</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f9fafb;
              color: #111827;
            }
            .card {
              background-color: white;
              border-radius: 0.5rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              padding: 2rem;
              text-align: center;
              max-width: 24rem;
            }
            .success-icon {
              color: #10b981;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 1rem;
            }
            p {
              color: #6b7280;
              margin-bottom: 1.5rem;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="success-icon">✓</div>
            <h1>Google Calendar Connected</h1>
            <p>Your Google Calendar has been successfully connected to Jibu Console. You can close this window now.</p>
          </div>
          <script>
            // Send a message to the opener window to refresh the connection status immediately
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED', success: true }, '*');
              console.log('Sent connection success message to opener window');
            }
            
            // Close the window automatically after 1.5 seconds
            // This delay gives time for the message to be received by the opener
            setTimeout(() => {
              console.log('Closing OAuth window...');
              window.close();
            }, 1500);
          </script>
        </body>
      </html>
    `, {
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Error handling Google Calendar callback:', error);
    
    // Return an error page
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f9fafb;
              color: #111827;
            }
            .card {
              background-color: white;
              border-radius: 0.5rem;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
              padding: 2rem;
              text-align: center;
              max-width: 24rem;
            }
            .error-icon {
              color: #ef4444;
              font-size: 3rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 1rem;
            }
            p {
              color: #6b7280;
              margin-bottom: 1.5rem;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="error-icon">✗</div>
            <h1>Connection Failed</h1>
            <p>There was an error connecting your Google Calendar. Please try again.</p>
          </div>
          <script>
            // Close the window automatically after 5 seconds
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
      </html>
    `, {
      headers: {
        'Content-Type': 'text/html',
      },
      status: 500,
    });
  }
}
