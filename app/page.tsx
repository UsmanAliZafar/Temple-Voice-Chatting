'use client';
// page.tsx
import { useState, useRef, useEffect } from 'react';
import { Message } from './types/chat';
import VoiceRecorder from './components/VoiceRecorder';
import ChatMessages from './components/ChatMessages';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add this to your handleVoiceData function in page.tsx
  const handleVoiceData = async (audioBlob: Blob) => {
    console.log('========================================');
    console.log('🎤 FRONTEND: Starting voice data processing');
    console.log('Audio blob size:', audioBlob.size, 'bytes');
    console.log('========================================');
    
    setIsProcessing(true);

    const userAudioUrl = URL.createObjectURL(audioBlob);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: '🎤 Voice message',
      timestamp: new Date(),
      audioUrl: userAudioUrl,
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.mp3');

      console.log('📡 Sending request to /api/chat...');
      const startTime = Date.now();
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      const duration = Date.now() - startTime;
      console.log(`📡 Response received in ${duration}ms with status ${response.status}`);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response JSON');
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        // Log the full error for debugging but don't use console.error for expected errors
        console.log('API returned error:', {
          status: response.status,
          error: data.error,
          message: data.message,
          details: data.details
        });
        
        // Create user-friendly error message based on the error type
        let errorMessage = 'Sorry, there was an error processing your message.';
        
        if (data.message) {
          // Check for specific error patterns
          if (data.message.includes('missing') || 
              data.message.includes('audio file was not received') ||
              data.message.includes('Field required')) {
            errorMessage = '🎤 Audio not detected. Please check your microphone and try again.';
          } else if (data.message.includes('too small') || 
                    data.message.includes('empty')) {
            errorMessage = '🎤 Recording is too short. Please speak longer and try again.';
          } else if (data.message.includes('Validation error')) {
            errorMessage = '⚠️ Invalid audio format. Please try recording again.';
          } else if (data.message.includes('microphone')) {
            errorMessage = `🎤 ${data.message}`;
          } else if (response.status === 500) {
            errorMessage = '⚠️ Server error occurred. Please try again.';
          } else if (response.status === 400) {
            errorMessage = `⚠️ ${data.message}`;
          } else {
            // For other errors, show the message if it's user-friendly
            errorMessage = `⚠️ ${data.message}`;
          }
        } else if (response.status === 500) {
          errorMessage = '⚠️ Server error. Please try again later.';
        } else if (response.status === 400) {
          errorMessage = '⚠️ Invalid request. Please try recording again.';
        }
        
        throw new Error(errorMessage);
      }

      // Success case
      if (!data.success || !data.audioUrl) {
        console.warn('Response missing expected data:', data);
        throw new Error('Invalid response format from server');
      }

      console.log('✅ Successfully received audio response');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.text || '🔊 Voice response',
        timestamp: new Date(),
        audioUrl: data.audioUrl,
      };

      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ Processing completed successfully');
      console.log('========================================');
      
    } catch (error: any) {
      // Only use console.error for unexpected/genuine errors
      if (error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('Invalid response')) {
        console.error('Genuine error occurred:', error);
      } else {
        // Expected errors (validation, etc.) just log normally
        console.log('User-facing error:', error.message);
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: error.message || 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      console.log('========================================');
    }
  };

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="header-logo">
            <div className="logo-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="logo-text">
              <h1>VoiceChat AI</h1>
              <p>Speak naturally, chat intelligently</p>
            </div>
          </div>
          <button className="settings-button">Settings</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {/* Welcome Section */}
        {messages.length === 0 && (
          <div className="welcome-section">
            <div className="welcome-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2>Welcome to VoiceChat AI</h2>
            <p>
              Press the microphone button below to start a conversation. 
              Speak naturally and I'll respond with text and voice.
            </p>
            
            {/* Feature Cards */}
            <div className="feature-cards">
              <div className="feature-card">
                <div className="feature-icon indigo">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3>Instant Response</h3>
                <p>Get quick answers to your questions with real-time voice processing</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon purple">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3>Natural Language</h3>
                <p>Speak naturally as you would in a normal conversation</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon pink">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3>Smart AI</h3>
                <p>Powered by advanced AI for intelligent conversations</p>
              </div>
            </div>
          </div>
        )}

        {/* Chat Container */}
        <div className="chat-container">
          {/* Messages Area */}
          <div className="messages-area">
            {messages.length > 0 ? (
              <div className="messages-list">
                <ChatMessages messages={messages} />
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="empty-state">
                <p>No messages yet. Start speaking to begin!</p>
              </div>
            )}
            
            {isProcessing && (
              <div className="processing-indicator">
                <div className="processing-dots">
                  <div className="processing-dot"></div>
                  <div className="processing-dot"></div>
                  <div className="processing-dot"></div>
                </div>
                <span>Processing...</span>
              </div>
            )}
          </div>

          {/* Voice Recorder Section */}
          <div className="recorder-section">
            <VoiceRecorder 
              onVoiceData={handleVoiceData}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="footer-info">
          <p>Press and hold the microphone to record. Release to send.</p>
        </div>
      </main>
    </div>
  );
}