// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('🎙️ API ROUTE CALLED');
  console.log('========================================');
  
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('session_id') as string;

    console.log('📥 Received data:');
    console.log('   - Session ID:', sessionId);
    console.log('   - Audio file:', audioFile?.name);

    if (!audioFile) {
      console.error('❌ No audio file in request');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      console.error('❌ No session ID in request');
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }

    console.log('✅ Audio file received:');
    console.log('   - Name:', audioFile.name);
    console.log('   - Size:', audioFile.size, 'bytes');
    console.log('   - Type:', audioFile.type);

    // Validate audio file size
    if (audioFile.size < 1000) {
      console.error('❌ Audio file too small:', audioFile.size, 'bytes');
      return NextResponse.json(
        { 
          error: 'Audio file is too small or empty',
          message: 'Please record audio with your microphone unmuted'
        },
        { status: 400 }
      );
    }

    // Validate it's actually an audio file
    if (!audioFile.type.includes('audio') && !audioFile.type.includes('mpeg')) {
      console.error('❌ Invalid file type:', audioFile.type);
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          message: 'Only audio files are accepted'
        },
        { status: 400 }
      );
    }

    // Create FormData for external API
    const apiFormData = new FormData();
    apiFormData.append('session_id', sessionId);
    apiFormData.append('audio', audioFile, 'audio.mp3');

    const apiUrl = 'http://208.122.213.38:8000/voice-to-voice';
    console.log('📡 Calling:', apiUrl);
    console.log('📡 Sending session_id:', sessionId);
    console.log('📡 Sending audio:', audioFile.size, 'bytes');

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: apiFormData,
    });

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorMessage = `API returned status ${response.status}`;
      let errorDetails = null;

      try {
        const errorData = await response.json();
        console.error('❌ API Error Response:', JSON.stringify(errorData, null, 2));
        
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            const errors = errorData.detail.map((err: any) => {
              const field = err.loc ? err.loc.join('.') : 'unknown';
              return `${field}: ${err.msg}`;
            }).join(', ');
            
            errorMessage = `Validation error: ${errors}`;
            errorDetails = errorData.detail;
            
            const missingAudio = errorData.detail.some((err: any) => 
              err.type === 'missing' && 
              err.loc && 
              err.loc.includes('audio')
            );
            
            if (missingAudio) {
              errorMessage = 'Audio file was not received by the API. This might be due to an empty or corrupted audio file.';
            }
          } else if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          }
        }
      } catch (parseError) {
        console.error('❌ Could not parse error response');
        const errorText = await response.text();
        console.error('❌ Raw error:', errorText);
        errorMessage = errorText || errorMessage;
      }

      return NextResponse.json(
        { 
          error: 'API request failed',
          message: errorMessage,
          status: response.status,
          details: errorDetails
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    console.log('📥 Response content-type:', contentType);

    if (!contentType?.includes('audio') && !contentType?.includes('mpeg') && !contentType?.includes('octet-stream')) {
      console.warn('⚠️ Unexpected content-type:', contentType);
      try {
        const jsonResponse = await response.json();
        console.error('❌ Expected audio but got JSON:', jsonResponse);
        return NextResponse.json(
          { 
            error: 'Unexpected response format',
            message: 'API did not return audio',
            details: jsonResponse
          },
          { status: 500 }
        );
      } catch {
        // Not JSON, continue with audio processing
      }
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('✅ Received audio buffer:', audioBuffer.byteLength, 'bytes');

    if (audioBuffer.byteLength === 0) {
      console.error('❌ Received empty audio buffer');
      return NextResponse.json(
        { 
          error: 'Empty audio response',
          message: 'API returned an empty audio file'
        },
        { status: 500 }
      );
    }

    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    console.log('✅ SUCCESS - Audio size:', audioBuffer.byteLength, 'bytes');
    console.log('========================================');

    return NextResponse.json({
      success: true,
      text: '🔊 Voice response',
      audioUrl: audioDataUrl,
      metadata: {
        audioSize: audioBuffer.byteLength,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('========================================');
    console.error('❌ CRITICAL ERROR IN API ROUTE');
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