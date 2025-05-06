import { NextRequest, NextResponse } from "next/server";
import { withAuthAndOrg } from "../../../../../../utils/apiRouteProtection";
import { API_BASE_URL } from "../../../../../../utils/api";

// Handler for POST requests - link a file to a knowledge base
export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    // Wait for params to be fully available
    const params = context.params;
    const knowledgeBaseId = params.id;
    
    return withAuthAndOrg(
      request,
      async (session, organizationId, request) => {
        try {
          // Parse the request body
          const requestData = await request.json();
          
          // Check if fileId is provided
          if (!requestData.fileId) {
            return NextResponse.json(
              { error: 'File ID is required' },
              { status: 400 }
            );
          }
          
          // Use the organizationId from the request headers or URL if present
          const requestOrgId = request.headers.get('x-organization-id') || 
                              new URL(request.url).searchParams.get('organizationId') || 
                              organizationId;
          
          // Ensure organizationId is included in the request body
          const dataWithOrgId = {
            ...requestData,
            organizationId: requestOrgId,
            sourceType: 'file',
            indexingStatus: 'PENDING' // Set default indexing status
          };
          
          console.log(`Linking file ${requestData.fileId} to knowledge base ${knowledgeBaseId} in org ${requestOrgId}`);
          
          // Forward the request to the backend API - use /sources endpoint instead of /link-file
          const response = await fetch(`${API_BASE_URL}/v1/knowledge-bases/${knowledgeBaseId}/sources`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'x-organization-id': requestOrgId || '',
              'organization-id': requestOrgId || '' // Adding both header formats for compatibility
            },
            body: JSON.stringify(dataWithOrgId)
          });
          
          if (!response.ok) {
            let errorMessage = `Server returned ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || errorData.details || errorMessage;
            } catch (parseError) {
              // If JSON parsing fails, try to get text
              const errorText = await response.text();
              if (errorText) errorMessage = errorText;
            }
            
            console.error(`Error from backend: ${response.status}: ${errorMessage}`);
            return NextResponse.json(
              { error: errorMessage },
              { status: response.status }
            );
          }
          
          const data = await response.json();
          
          // Verify we have a valid response
          if (!data || !data.id) {
            console.error('Backend returned invalid source data:', data);
            return NextResponse.json(
              { error: 'Invalid source data returned from backend' },
              { status: 500 }
            );
          }
          
          // Ensure the response contains the correct organizationId
          if (!data.organizationId || data.organizationId !== requestOrgId) {
            console.warn(`Backend returned different organizationId: ${data.organizationId}, fixing to: ${requestOrgId}`);
            data.organizationId = requestOrgId;
          }
          
          console.log(`File linked successfully: ${data.id} with organization ${data.organizationId}`);
          return NextResponse.json(data);
        } catch (error) {
          console.error(`Error in link-file POST for KB ${knowledgeBaseId}:`, error);
          
          // Try to extract a meaningful error message
          let errorMessage = 'Failed to link file to knowledge base';
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
          );
        }
      },
      { requireOrg: true }
    );
  } catch (error) {
    console.error('Error processing knowledge base link-file request:', error);
    return NextResponse.json(
      { error: 'Failed to process the request' },
      { status: 500 }
    );
  }
} 