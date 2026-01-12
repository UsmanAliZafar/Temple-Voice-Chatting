// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('========================================');
  console.log('🎙️ API ROUTE CALLED');
  console.log('========================================');
  
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('✅ Audio file received:');
    console.log('   - Name:', audioFile.name);
    console.log('   - Size:', audioFile.size, 'bytes');
    console.log('   - Type:', audioFile.type);

    // Create FormData for external API
    const apiFormData = new FormData();
    apiFormData.append('session_id', '');
    apiFormData.append('audio', audioFile, 'audio.mp3'); // Ensure .mp3 extension

    const apiUrl = 'http://208.122.213.38:8000/voice-to-voice';
    console.log('📡 Calling:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: apiFormData,
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('✅ Received audio:', audioBuffer.byteLength, 'bytes');

    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    console.log('✅ SUCCESS');
    return NextResponse.json({
      success: true,
      text: 'AI Response',
      audioUrl: audioDataUrl,
    });

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    return NextResponse.json(
      { error: 'Failed to process audio', message: error.message },
      { status: 500 }
    );
  }
}