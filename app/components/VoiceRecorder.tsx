'use client';
// components/VoiceRecorder.tsx
import { useState, useRef } from 'react';

interface VoiceRecorderProps {
  onVoiceData: (audioBlob: Blob) => void;
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ 
  onVoiceData, 
  isRecording, 
  setIsRecording,
  disabled = false 
}: VoiceRecorderProps) {
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try to use audio/webm or audio/mp4 for better compatibility
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = 'audio/ogg';
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        onVoiceData(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      let time = 0;
      timerRef.current = setInterval(() => {
        time += 1;
        setRecordingTime(time);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="recorder-container">
      {/* Recording Indicator */}
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span className="recording-time">
            Recording: {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Microphone Button */}
      <div className="mic-button-wrapper">
        {isRecording && <div className="mic-button-pulse"></div>}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={disabled}
          className={`mic-button ${isRecording ? 'recording' : ''}`}
        >
          {isRecording ? (
            <svg className="mic-button-stop-icon" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
      </div>

      {/* Instructions */}
      <p className="recorder-instructions">
        {isRecording 
          ? 'Release to send your message'
          : 'Press and hold to record'
        }
      </p>
    </div>
  );
}