'use client';
// components/VoiceRecorder.tsx
import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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
  const [error, setError] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hasAudioInputRef = useRef<boolean>(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  // Load FFmpeg
  useEffect(() => {
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFfmpegLoaded(true);
      console.log('✅ FFmpeg loaded successfully');
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      setError('Failed to load audio converter');
    }
  };

  // Monitor audio level
  const startAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);

        // If average volume is above threshold, we have audio input
        if (average > 5) { // Threshold for detecting audio
          hasAudioInputRef.current = true;
        }

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.error('Failed to start audio monitoring:', error);
    }
  };

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Validate audio has actual content
  const validateAudioContent = async (audioBlob: Blob): Promise<boolean> => {
    // Check if blob is too small (likely empty)
    if (audioBlob.size < 1000) { // Less than 1KB is probably empty
      console.warn('⚠️ Audio file too small:', audioBlob.size, 'bytes');
      return false;
    }

    // Check if we detected any audio input during recording
    if (!hasAudioInputRef.current) {
      console.warn('⚠️ No audio input detected during recording');
      return false;
    }

    return true;
  };

  // Convert WebM to MP3
  const convertToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    if (!ffmpegRef.current) {
      throw new Error('FFmpeg not loaded');
    }

    setIsConverting(true);
    console.log('🔄 Converting WebM to MP3...');

    try {
      const ffmpeg = ffmpegRef.current;

      await ffmpeg.writeFile('input.webm', await fetchFile(webmBlob));
      console.log('✅ Input file written');

      await ffmpeg.exec([
        '-i', 'input.webm',
        '-vn',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '192k',
        'output.mp3'
      ]);
      console.log('✅ Conversion complete');

      const data = await ffmpeg.readFile('output.mp3');
      const mp3Blob = new Blob([data as unknown as BlobPart], { type: 'audio/mpeg' });
      console.log('✅ MP3 blob created:', mp3Blob.size, 'bytes');

      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp3');

      return mp3Blob;
    } finally {
      setIsConverting(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopAudioLevelMonitoring();
    };
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording || !ffmpegLoaded) return;

    try {
      setError('');
      hasAudioInputRef.current = false; // Reset audio detection
      console.log('Requesting microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;
      console.log('Microphone access granted');

      // Start monitoring audio levels
      startAudioLevelMonitoring(stream);

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ];

      let selectedMimeType = '';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          console.log('Using MIME type:', selectedMimeType);
          break;
        }
      }

      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, chunks:', chunksRef.current.length);

        // Stop audio monitoring
        stopAudioLevelMonitoring();

        if (chunksRef.current.length > 0) {
          const mimeType = selectedMimeType || 'audio/webm';
          const webmBlob = new Blob(chunksRef.current, { type: mimeType });
          console.log('Created WebM blob:', webmBlob.size, 'bytes');

          // Validate audio content
          const isValid = await validateAudioContent(webmBlob);

          if (!isValid) {
            setError('No audio detected. Please check your microphone and make sure it\'s not muted.');
            console.error('❌ Audio validation failed');
          } else {
            try {
              // Convert to MP3
              const mp3Blob = await convertToMp3(webmBlob);

              // Double-check MP3 size
              if (mp3Blob.size < 1000) {
                setError('Recorded audio is too short or empty. Please try again.');
              } else {
                onVoiceData(mp3Blob);
              }
            } catch (error) {
              console.error('Conversion error:', error);
              setError('Failed to convert audio to MP3');
            }
          }
        } else {
          setError('Recording failed: no audio chunks captured');
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setRecordingTime(0);
        setIsRecording(false);
        hasAudioInputRef.current = false;
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred');
        stopRecording();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      console.log('Recording started');

      let time = 0;
      timerRef.current = setInterval(() => {
        time += 1;
        setRecordingTime(time);

        // Warn user if no audio detected after 3 seconds
        if (time === 3 && !hasAudioInputRef.current) {
          console.warn('⚠️ No audio detected after 3 seconds');
        }
      }, 1000);

    } catch (error: any) {
      console.error('Error accessing microphone:', error);

      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Could not access microphone: ' + error.message);
      }
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording...');

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isDisabled = disabled || !ffmpegLoaded || isConverting;

  return (
    <div className="recorder-container">
      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Loading FFmpeg */}
      {!ffmpegLoaded && (
        <div className="loading-message">
          <p>Loading audio converter...</p>
        </div>
      )}

      {/* Converting Indicator */}
      {isConverting && (
        <div className="converting-indicator">
          <div className="spinner"></div>
          <span>Converting audio to MP3...</span>
        </div>
      )}

      {/* Recording Indicator with Audio Level */}
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span className="recording-time">
            Recording: {formatTime(recordingTime)}
          </span>
          <div className="audio-level-container">
            <div
              className="audio-level-bar"
              style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
            />
          </div>
          {recordingTime > 3 && !hasAudioInputRef.current && (
            <span className="audio-warning">⚠️ No audio detected</span>
          )}
        </div>
      )}

      {/* Microphone Button */}
      <div className="mic-button-wrapper">
        {isRecording && <div className="mic-button-pulse"></div>}
        <button
          onClick={handleClick}
          disabled={isDisabled}
          className={`mic-button ${isRecording ? 'recording' : ''} ${isDisabled ? 'disabled' : ''}`}
          aria-label={isRecording ? 'Click to stop recording' : 'Click to start recording'}
        >
          {isRecording ? (
            <svg className="mic-button-stop-icon" viewBox="0 0 24 24" fill="currentColor">
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
        {!ffmpegLoaded
          ? 'Loading...'
          : isConverting
            ? 'Converting audio...'
            : isRecording
              ? 'Click again to stop and send'
              : disabled
                ? 'Please wait...'
                : 'Click to start recording'
        }
      </p>
    </div>
  );
}