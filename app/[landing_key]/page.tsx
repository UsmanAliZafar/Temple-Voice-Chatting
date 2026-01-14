'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Message } from '../types/chat';
import VoiceRecorder from '../components/VoiceRecorder';
import ChatMessages from '../components/ChatMessages';

interface SessionData {
  status: boolean;
  session_id: string;
  customer: {
    id: number;
    name: string;
    email: string;
  };
  agent: {
    id: number;
    operator_id: number;
    name: string;
    operator_profile_image: string | null;
  };
  url: string;
}

interface ErrorResponse {
  status: false;
  session: string;
  message: string;
}

export default function ChatPage() {
  const params = useParams();
  const landing_key = params.landing_key as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [errorType, setErrorType] = useState<'expired' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const backUrl = process.env.NEXT_PUBLIC_BACK_URL_SESSION_EXPIRED || 'https://phonetalktemple.com';

  // Fetch session data on mount
  useEffect(() => {
    if (landing_key) {
      fetchSessionData();
    }
  }, [landing_key]);

  const fetchSessionData = async () => {
    try {
      setIsLoading(true);
      setError('');
      setIsSessionExpired(false);
      setErrorType(null);
      
      console.log('Fetching session data for:', landing_key);
      
      const response = await fetch(`/api/get-session-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ landing_key }),
      });
      
      const data = await response.json();

      // Check if session is expired
      if (!data.status && data.session === 'expired') {
        console.log('Session expired:', data.message);
        setIsSessionExpired(true);
        setErrorType('expired');
        setErrorMessage(data.message || 'This chat session has been ended. Please start a new session.');
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch session data');
      }
      
      if (!data.status) {
        throw new Error(data.message || 'Invalid session');
      }

      console.log('Session data loaded:', data);
      setSessionData(data);
      setIsLoading(false);
      
    } catch (error: any) {
      console.error('Error fetching session data:', error);
      setError(error.message || 'Failed to load session');
      setErrorType('error');
      setErrorMessage(error.message || 'Failed to load session');
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.href = backUrl;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleVoiceData = async (audioBlob: Blob) => {
    if (!sessionData) {
      console.error('No session data available');
      return;
    }

    console.log('========================================');
    console.log('🎤 FRONTEND: Starting voice data processing');
    console.log('Session ID:', sessionData.session_id);
    console.log('Customer:', sessionData.customer.name);
    console.log('Agent:', sessionData.agent.name);
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
      formData.append('session_id', sessionData.session_id);

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

      // Check if session expired during chat
      if (!data.status && data.session === 'expired') {
        console.log('Session expired during chat:', data.message);
        setIsSessionExpired(true);
        setErrorType('expired');
        setErrorMessage(data.message || 'This chat session has been ended. Please start a new session.');
        return;
      }

      if (!response.ok) {
        console.log('API returned error:', {
          status: response.status,
          error: data.error,
          message: data.message,
          details: data.details
        });
        
        let errorMessage = 'Sorry, there was an error processing your message.';
        
        if (data.message) {
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
            errorMessage = `⚠️ ${data.message}`;
          }
        } else if (response.status === 500) {
          errorMessage = '⚠️ Server error. Please try again later.';
        } else if (response.status === 400) {
          errorMessage = '⚠️ Invalid request. Please try recording again.';
        }
        
        throw new Error(errorMessage);
      }

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
      if (error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('Invalid response')) {
        console.error('Genuine error occurred:', error);
      } else {
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

  // Loading state
  if (isLoading) {
    return (
      <div>
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
                <p>Loading session...</p>
              </div>
            </div>
          </div>
        </header>

        <main className="main-container">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading chat session...</p>
          </div>
        </main>
      </div>
    );
  }

  // Session Expired State
  if (isSessionExpired && errorType === 'expired') {
    return (
      <div>
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
                <p>Session Expired</p>
              </div>
            </div>
          </div>
        </header>

        <main className="main-container">
          <div className="session-expired-container">
            <div className="expired-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2>Session Expired</h2>
            <p className="expired-message">{errorMessage}</p>
            <button onClick={handleGoBack} className="back-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="back-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back to Start New Session
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error || !sessionData) {
    return (
      <div>
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
                <p>Session Error</p>
              </div>
            </div>
          </div>
        </header>

        <main className="main-container">
          <div className="error-container">
            <div className="error-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2>Session Error</h2>
            <p>{errorMessage || error || 'Failed to load session'}</p>
            <div className="error-actions">
              <button onClick={fetchSessionData} className="retry-button">
                Try Again
              </button>
              <button onClick={handleGoBack} className="back-button-secondary">
                Go Back
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main chat interface
  return (
    <div>
      {/* Session Expired Overlay during chat */}
      {isSessionExpired && (
        <div className="session-expired-overlay">
          <div className="session-expired-modal">
            <div className="expired-icon-modal">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2>Session Expired</h2>
            <p>{errorMessage}</p>
            <button onClick={handleGoBack} className="back-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="back-icon">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back to Start New Session
            </button>
          </div>
        </div>
      )}

      {/* Header with User Info */}
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
              <p>Chatting with {sessionData.agent.name}</p>
            </div>
          </div>
          
          <div className="user-info">
            <div className="user-avatar-placeholder">
              {sessionData.customer.name.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">{sessionData.customer.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {/* Welcome Section */}
        {messages.length === 0 && (
          <div className="welcome-section">
            <div className="welcome-icon">
              {sessionData.agent.operator_profile_image ? (
                <img 
                  src={sessionData.agent.operator_profile_image} 
                  alt={sessionData.agent.name}
                  className="agent-avatar-large-image"
                />
              ) : (
                <div className="agent-avatar-large">
                  {sessionData.agent.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h2>Chat with {sessionData.agent.name}</h2>
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
              disabled={isProcessing || isSessionExpired}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="footer-info">
          <p>Session: {sessionData.session_id}</p>
          <a href={sessionData.url} target="_blank" rel="noopener noreferrer" className="agent-link">
            View Agent Profile
          </a>
        </div>
      </main>
    </div>
  );
}