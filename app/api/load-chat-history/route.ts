// app/api/load-chat-history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('📜 LOAD CHAT HISTORY API CALLED');
  console.log('========================================');
  
  try {
    const { session_id } = await request.json();

    console.log('📥 Session ID:', session_id);

    if (!session_id) {
      console.error('❌ No session ID provided');
      return NextResponse.json(
        { 
          success: false,
          error: 'No session ID provided' 
        },
        { status: 400 }
      );
    }

    // Call external load chat API
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${baseUrl}/load-chat`;
    console.log('📡 Calling external API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        master_id: session_id,
        timezone: 'UTC'
      }),
    });

    console.log('📡 Response status:', response.status);

    const data = await response.json();
    console.log('📡 Response data:', {
      status: data.status,
      session: data.session,
      historyCount: data.chatHistory?.length || 0
    });

    if (!response.ok) {
      console.error('❌ API Error:', data);
      return NextResponse.json(
        { 
          success: false,
          error: data.message || 'Failed to load chat history',
          details: data
        },
        { status: response.status }
      );
    }

    console.log('✅ Chat history loaded successfully');
    console.log('========================================');

    return NextResponse.json({
      success: true,
      status: data.status,
      session: data.session,
      chatHistory: data.chatHistory || []
    });

  } catch (error: any) {
    console.error('========================================');
    console.error('❌ CRITICAL ERROR IN LOAD CHAT HISTORY');
    console.error('Error:', error.message);
    console.error('========================================');
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to load chat history',
        message: error.message
      },
      { status: 500 }
    );
  }
}