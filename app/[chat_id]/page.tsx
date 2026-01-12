'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Message } from '../types/chat';
import VoiceRecorder from '../components/VoiceRecorder';
import ChatMessages from '../components/ChatMessages';

interface ChatData {
  status: boolean;
  chat_id: string;
  sender: {
    client_id: number;
    name: string;
    profile_image: string;
  };
  receiver: {
    session_id: string;
    name: string;
    profile_image: string;
  };
}

export default function ChatPage() {
  const params = useParams();
  const chat_id = params.chat_id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatData, setChatData] = useState<ChatData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat data on mount
  useEffect(() => {
    if (chat_id) {
      fetchChatData();
    }
  }, [chat_id]);

  const fetchChatData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      console.log('Fetching chat data for:', chat_id);
      const response = await fetch(`https://mocki.io/v1/${chat_id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat data');
      }

      const data: ChatData = await response.json();
      
      if (!data.status) {
        throw new Error('Invalid chat session');
      }

      console.log('Chat data loaded:', data);
      setChatData(data);
      setIsLoading(false);
      
    } catch (error: any) {
      console.error('Error fetching chat data:', error);
      setError(error.message || 'Failed to load chat');
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleVoiceData = async (audioBlob: Blob) => {
    if (!chatData) {
      console.error('No chat data available');
      return;
    }

    console.log('========================================');
    console.log('🎤 FRONTEND: Starting voice data processing');
    console.log('Chat ID:', chatData.chat_id);
    console.log('Session ID:', chatData.receiver.session_id);
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
      formData.append('session_id', chatData.receiver.session_id);
      formData.append('chat_id', chatData.chat_id);

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

  // Error state
  if (error || !chatData) {
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
            <p>{error || 'Failed to load chat session'}</p>
            <button onClick={fetchChatData} className="retry-button">
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Main chat interface
  return (
    <div>
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
              <p>Chatting with {chatData.receiver.name}</p>
            </div>
          </div>
          
          <div className="user-info">
            <img 
              src={chatData.sender.profile_image} 
              alt={chatData.sender.name}
              className="user-avatar"
            />
            <span className="user-name">{chatData.sender.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {/* Welcome Section */}
        {messages.length === 0 && (
          <div className="welcome-section">
            <div className="welcome-icon">
              <img 
                src={chatData.receiver.profile_image} 
                alt={chatData.receiver.name}
                className="receiver-avatar-large"
              />
            </div>
            <h2>Chat with {chatData.receiver.name}</h2>
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
          <p>Chat ID: {chatData.chat_id} | Session: {chatData.receiver.session_id}</p>
        </div>
      </main>
    </div>
  );
}