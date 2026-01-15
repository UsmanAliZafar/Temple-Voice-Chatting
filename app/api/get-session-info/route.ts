// app/api/get-session-info/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('🔑 GET SESSION INFO API CALLED');
  console.log('========================================');
  
  try {
    const { landing_key } = await request.json();

    console.log('📥 Received landing key (raw):', landing_key);

    if (!landing_key) {
      console.error('❌ No landing key provided');
      return NextResponse.json(
        { error: 'No landing key provided' },
        { status: 400 }
      );
    }

    // Decode the URL-encoded landing key first
    // %2B becomes + (plus sign)
    const decodedKey = decodeURIComponent(landing_key);
    console.log('📥 Decoded landing key:', decodedKey);

    // Convert plus signs (+) to slashes (/)
    // From: pofadQcwOEQQZ34_ocSO3DeHG1hAxgaAMmlLbf8c4c0+Landing+phonetalktemple.com
    // To:   pofadQcwOEQQZ34_ocSO3DeHG1hAxgaAMmlLbf8c4c0/Landing/phonetalktemple.com
    const convertedKey = decodedKey.replace(/\+/g, '/');
    
    console.log('✅ Converted landing key:', convertedKey);

    // Parse the converted key to extract session_id and domain
    const parts = convertedKey.split('/Landing/');
    
    if (parts.length !== 2) {
      console.error('❌ Invalid landing key format:', convertedKey);
      return NextResponse.json(
        { error: 'Invalid landing key format. Expected format: {session_id}+Landing+{domain}' },
        { status: 400 }
      );
    }

    const sessionId = parts[0];
    const domain = parts[1];

    console.log('✅ Parsed landing key:');
    console.log('   - Session ID:', sessionId);
    console.log('   - Domain:', domain);

    // IMPORTANT: Send the converted key WITH SLASHES to the API
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${baseUrl}/get-info/${convertedKey}`;
    console.log('📡 Calling API URL:', apiUrl);
    console.log('📡 Landing key being sent:', convertedKey);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response content-type:', response.headers.get('content-type'));

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Response is not JSON, content-type:', contentType);
      const textResponse = await response.text();
      console.error('❌ Response text (first 500 chars):', textResponse.substring(0, 500));
      
      return NextResponse.json(
        { 
          error: 'Invalid response from server',
          message: 'Server returned non-JSON response. The session key might be invalid or the server is having issues.',
          details: {
            contentType,
            statusCode: response.status,
            apiUrl: apiUrl,
            sentKey: convertedKey
          }
        },
        { status: 500 }
      );
    }

    let data;
    try {
      data = await response.json();
      console.log('📡 Response data:', JSON.stringify(data, null, 2));
    } catch (parseError: any) {
      console.error('❌ Failed to parse JSON response:', parseError.message);
      return NextResponse.json(
        { 
          error: 'Failed to parse server response',
          message: 'The server returned invalid JSON data',
          details: parseError.message
        },
        { status: 500 }
      );
    }

    // Check if session is expired
    if (!data.status && data.session === 'expired') {
      console.log('⏰ Session expired:', data.message);
      return NextResponse.json(
        {
          status: false,
          session: 'expired',
          message: data.message || 'This chat session has been ended. Please start a new session.'
        },
        { status: 200 } // Return 200 for expired sessions so frontend can handle it properly
      );
    }

    if (!response.ok) {
      let errorMessage = `API returned status ${response.status}`;
      
      if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      }

      console.error('❌ API Error Response:', errorMessage);

      return NextResponse.json(
        { 
          error: 'Failed to fetch session info',
          message: errorMessage,
          status: response.status
        },
        { status: response.status }
      );
    }

    if (!data.status) {
      console.error('❌ Invalid session status');
      return NextResponse.json(
        { 
          error: 'Invalid session',
          message: data.message || 'Session is not active or valid'
        },
        { status: 400 }
      );
    }

    console.log('✅ SUCCESS - Session info retrieved');
    console.log('   - Original key (URL encoded):', landing_key);
    console.log('   - Decoded key (with plus signs):', decodedKey);
    console.log('   - Converted key (with slashes):', convertedKey);
    console.log('   - Session ID:', data.session_id);
    console.log('   - Customer:', data.customer.name);
    console.log('   - Agent:', data.agent.name);
    console.log('   - Agent Image:', data.agent.operator_profile_image || 'No image');
    console.log('========================================');

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('========================================');
    console.error('❌ CRITICAL ERROR IN GET SESSION INFO');
    console.error('========================================');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message || 'An unexpected error occurred',
        errorType: error.constructor.name
      },
      { status: 500 }
    );
  }
}