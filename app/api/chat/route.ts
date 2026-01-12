import { NextRequest, NextResponse } from 'next/server';
// api/chat/route.ts
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Create FormData for the external API
    const apiFormData = new FormData();
    apiFormData.append('session_id', ''); // Empty session_id as per your API
    apiFormData.append('audio', audioFile);

    // Call your voice-to-voice API
    const apiUrl = process.env.VOICE_API_URL || 'http://208.122.213.38:8000/voice-to-voice';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: apiFormData,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // The API returns audio directly
    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    
    // Convert to base64 to send to frontend
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return NextResponse.json({
      text: 'Voice response received',
      audioUrl: audioDataUrl,
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}