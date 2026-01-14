// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    const sessionId = formData.get("session_id") as string;

    console.log("=== Chat API Request ===");
    console.log("Audio file:", audioFile?.name, audioFile?.size, "bytes");
    console.log("Session ID:", sessionId);

    if (!audioFile || !sessionId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing audio file or session ID" 
        },
        { status: 400 }
      );
    }

    // Prepare form data for external API
    const externalFormData = new FormData();
    externalFormData.append("audio", audioFile);
    externalFormData.append("master_id", sessionId);
    externalFormData.append("timezone", "UTC");

    // Call external API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    console.log("Calling external API:", `${apiUrl}/chat`);

    const response = await fetch(`${apiUrl}/chat`, {
      method: "POST",
      body: externalFormData,
    });

    console.log("API Response Status:", response.status);
    console.log("API Response Content-Type:", response.headers.get("content-type"));

    if (!response.ok) {
      console.error("External API error:", response.status, response.statusText);
      
      // Try to read response body for error details
      let errorDetails = "";
      try {
        errorDetails = await response.text();
        console.error("Error response body:", errorDetails);
      } catch (e) {
        console.error("Could not read error response");
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: "External API request failed", 
          details: errorDetails,
          status: response.status
        },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    // Handle JSON responses (errors, session expiration, etc.)
    if (contentType.includes("application/json")) {
      const data = await response.json();
      console.log("JSON Response received:", data);
      
      // Check for session expiration
      if (data.error === "Session has expired" || data.expired) {
        return NextResponse.json(
          { 
            success: false,
            error: "Session has expired",
            expired: true 
          },
          { status: 401 }
        );
      }

      // Return the JSON data with success flag
      return NextResponse.json({
        success: true,
        ...data
      });
    }

    // Handle binary audio response (WAV, MP3, etc.)
    console.log("Processing binary audio response...");
    
    const audioBuffer = await response.arrayBuffer();
    console.log("Audio buffer size:", audioBuffer.byteLength, "bytes");
    
    if (audioBuffer.byteLength === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: "Received empty audio response" 
        },
        { status: 500 }
      );
    }

    // Convert to base64 for JSON transport
    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    
    // Determine audio format from content-type or response data
    let audioFormat = "wav";
    let mimeType = "audio/wav";
    
    if (contentType.includes("audio/mpeg") || contentType.includes("audio/mp3")) {
      audioFormat = "mp3";
      mimeType = "audio/mpeg";
    } else if (contentType.includes("audio/wav") || contentType.includes("audio/wave")) {
      audioFormat = "wav";
      mimeType = "audio/wav";
    } else if (contentType.includes("audio/webm")) {
      audioFormat = "webm";
      mimeType = "audio/webm";
    } else {
      // If content-type is not specific, detect from magic bytes
      const header = new Uint8Array(audioBuffer.slice(0, 12));
      const headerStr = String.fromCharCode(...header);
      
      if (headerStr.startsWith("RIFF") && headerStr.includes("WAVE")) {
        audioFormat = "wav";
        mimeType = "audio/wav";
        console.log("Detected WAV format from file header");
      } else if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
        audioFormat = "mp3";
        mimeType = "audio/mpeg";
        console.log("Detected MP3 format from file header");
      }
    }

    console.log("Audio format:", audioFormat);
    console.log("MIME type:", mimeType);
    console.log("Base64 length:", base64Audio.length);

    // Return consistent response format
    const responseData = {
      success: true,
      audio: base64Audio,
      format: audioFormat,
      mimeType: mimeType,
      size: audioBuffer.byteLength
    };

    console.log("=== Returning Success Response ===");
    console.log("Response keys:", Object.keys(responseData));
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error("=== Chat API Error ===");
    console.error("Error details:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to process chat request",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}