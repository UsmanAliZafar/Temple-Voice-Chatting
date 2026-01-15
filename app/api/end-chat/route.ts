// app/api/end-chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('🔚 END CHAT API CALLED');
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

    // Call external end chat API
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    const apiUrl = `${baseUrl}/end`;
    console.log('📡 Calling external API:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        master_id: session_id
      }),
    });

    console.log('📡 Response status:', response.status);

    const data = await response.json();
    console.log('📡 Response data:', data);

    if (!response.ok) {
      console.error('❌ API Error:', data);
      return NextResponse.json(
        { 
          success: false,
          error: data.message || 'Failed to end chat',
          details: data
        },
        { status: response.status }
      );
    }

    console.log('✅ Chat ended successfully');
    console.log('========================================');

    return NextResponse.json({
      success: true,
      message: 'Chat ended successfully',
      data
    });

  } catch (error: any) {
    console.error('========================================');
    console.error('❌ CRITICAL ERROR IN END CHAT');
    console.error('Error:', error.message);
    console.error('========================================');
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to end chat',
        message: error.message
      },
      { status: 500 }
    );
  }
}