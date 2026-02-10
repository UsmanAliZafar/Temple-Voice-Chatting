// [landing_key]/page.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Message, ChatHistoryItem } from '../types/chat';
import VoiceRecorder from '../components/VoiceRecorder';
import ChatMessages from '../components/ChatMessages';
import ThemeToggle from '../components/ThemeToggle';

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

// Helper function for random delays
const getRandomDelay = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

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
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isEndingChat, setIsEndingChat] = useState(false);
  const [showEndChatModal, setShowEndChatModal] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const chatSiteUrl = process.env.NEXT_PUBLIC_CHAT_SITE_URL || 'https://phonetalktemple.com';
  const backUrl = process.env.NEXT_PUBLIC_BACK_URL_SESSION_EXPIRED || 'https://phonetalktemple.com';

  // Helper function to convert base64 to blob URL
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const cleanBase64 = base64.replace(/\s/g, '');
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

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

  // Load chat history
  const loadChatHistory = async () => {
    if (!sessionData || historyLoaded) return;

    try {
      setIsLoadingHistory(true);
      console.log('📜 Loading chat history for session:', sessionData.session_id);

      const response = await fetch('/api/load-chat-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionData.session_id
        }),
      });

      const data = await response.json();

      if (!data.success) {
        console.error('❌ Failed to load chat history:', data.error);
        setHistoryLoaded(true); // Mark as loaded even if failed to prevent retry
        return;
      }

      if (data.chatHistory && data.chatHistory.length > 0) {
        console.log('✅ Loaded', data.chatHistory.length, 'history items');

        // Convert chat history to messages
        const historyMessages: Message[] = [];

        data.chatHistory.forEach((item: ChatHistoryItem) => {
          // If audio_message exists and audio_reply is empty, it's a USER message
          if (item.audio_message && !item.audio_reply) {
            historyMessages.push({
              id: `history-${item.id}-user`,
              type: 'user',
              content: '🎤 Voice message',
              timestamp: new Date(item.created_at),
              audioUrl: item.audio_message,
              status: 'seen',
              isHistorical: true
            });
          }

          // If audio_reply exists, it's an ASSISTANT message
          if (item.audio_reply) {
            historyMessages.push({
              id: `history-${item.id}-assistant`,
              type: 'assistant',
              content: '🔊 Voice response',
              timestamp: new Date(item.created_at),
              audioUrl: item.audio_reply,
              isHistorical: true
            });
          }
        });

        // API sends ASC (old to new), so we can directly set them
        setMessages(historyMessages);
        setHistoryLoaded(true);
        console.log('✅ Chat history loaded and displayed:', historyMessages.length, 'messages');
      } else {
        console.log('ℹ️ No chat history found');
        setHistoryLoaded(true);
      }

    } catch (error: any) {
      console.error('❌ Error loading chat history:', error);
      setHistoryLoaded(true); // Mark as loaded even if failed
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Load history after session data is loaded
  useEffect(() => {
    if (sessionData && !historyLoaded && !isLoadingHistory) {
      loadChatHistory();
    }
  }, [sessionData, historyLoaded, isLoadingHistory]);

  const handleGoBack = () => {
    window.location.href = backUrl;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleVoiceData = async (audioBlob: Blob) => {
    if (!sessionData) {
      console.error('No session data available');
      return;
    }

    console.log('========================================');
    console.log('🎤 FRONTEND: Starting voice data processing');
    console.log('Session ID:', sessionData.session_id);
    console.log('Current messages count:', messages.length);
    console.log('Customer:', sessionData.customer.name);
    console.log('Agent:', sessionData.agent.name);
    console.log('Audio blob size:', audioBlob.size, 'bytes');
    console.log('========================================');

    const userAudioUrl = URL.createObjectURL(audioBlob);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: '🎤 Voice message',
      timestamp: new Date(),
      audioUrl: userAudioUrl,
      status: 'sending',
      isHistorical: false,
    };

    // Append to existing messages (including history)
    setMessages(prev => [...prev, userMessage]);

    // Simulate delivery status (12-20 seconds)
    const deliveryDelay = getRandomDelay(12000, 20000);
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'delivered' as const }
            : msg
        )
      );
      console.log(`✅ Message delivered after ${deliveryDelay}ms`);
    }, deliveryDelay);

    // Simulate seen status (15-20 seconds)
    const seenDelay = getRandomDelay(15000, 20000);
    setTimeout(() => {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === userMessage.id
            ? { ...msg, status: 'seen' as const }
            : msg
        )
      );
      console.log(`✅ Message seen after ${seenDelay}ms`);
    }, seenDelay);

    try {
      const apiDelay = getRandomDelay(5000, 10000); // 5-10 seconds
      console.log(`⏳ Waiting ${apiDelay}ms before sending to API...`);
      await new Promise(resolve => setTimeout(resolve, apiDelay));

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.mp3');
      formData.append('session_id', sessionData.session_id);

      console.log('📡 Sending request to /api/chat...');
      const startTime = Date.now();
      const processingTimeout = setTimeout(() => {
        setIsProcessing(true);
      }, getRandomDelay(10000, 18000));

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(processingTimeout);

      const duration = Date.now() - startTime;
      console.log(`📡 Response received in ${duration}ms with status ${response.status}`);

      let data;
      try {
        data = await response.json();
        console.log('📦 Response data:', {
          success: data.success,
          hasAudio: !!data.audio,
          format: data.format,
          mimeType: data.mimeType,
          size: data.size
        });
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        throw new Error('Invalid response from server');
      }

      // Check if session expired during chat
      if (data.expired || (!data.status && data.session === 'expired')) {
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

      // Check for success and audio data (base64)
      if (!data.success) {
        console.error('Response indicates failure:', data);
        throw new Error(data.error || data.message || 'Request failed');
      }

      if (!data.audio) {
        console.error('Response missing audio data:', data);
        throw new Error('No audio data in response');
      }

      // Show typing indicator (2-5 seconds before response)
      setIsProcessing(false);
      const typingDelay = getRandomDelay(2000, 5000);
      setIsTyping(true);
      await new Promise(resolve => setTimeout(resolve, typingDelay));
      setIsTyping(false);

      console.log('✅ Successfully received audio response');
      console.log('Converting base64 to blob...');

      // Convert base64 audio to blob and create URL
      const mimeType = data.mimeType || 'audio/wav';
      const aiAudioBlob = base64ToBlob(data.audio, mimeType);
      const aiAudioUrl = URL.createObjectURL(aiAudioBlob);

      console.log('✅ Audio blob created:', {
        size: aiAudioBlob.size,
        type: aiAudioBlob.type,
        url: aiAudioUrl
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.text || '🔊 Voice response',
        timestamp: new Date(),
        audioUrl: aiAudioUrl,
        isHistorical: false
      };

      // Append to existing messages
      setMessages(prev => [...prev, assistantMessage]);
      console.log('✅ Processing completed successfully');
      console.log('========================================');

    } catch (error: any) {
      setIsTyping(false);
      setIsProcessing(false);

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
        isHistorical: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      setIsTyping(false);
      console.log('========================================');
    }
  };

  const handleEndChat = async () => {
    if (!sessionData) return;

    try {
      setIsEndingChat(true);
      console.log('🔚 Ending chat session:', sessionData.session_id);

      const response = await fetch('/api/end-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionData.session_id
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Chat ended successfully');
        window.location.href = sessionData.url;
      } else {
        console.error('❌ Failed to end chat:', data.error);
        setError('Failed to end chat. Please try again.');
        setIsEndingChat(false);
        setShowEndChatModal(false);
      }
    } catch (error: any) {
      console.error('❌ Error ending chat:', error);
      setError('Failed to end chat. Please try again.');
      setIsEndingChat(false);
      setShowEndChatModal(false);
    }
  };

  const openEndChatModal = () => {
    setShowEndChatModal(true);
  };

  const closeEndChatModal = () => {
    setShowEndChatModal(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <header className="chat-header">
          <div className="header-content">
            <div className="header-left">
              <div className="agent-profile-loading">
                <div className="spinner-small"></div>
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
        <header className="chat-header">
          <div className="header-content">
            <div className="header-left">
              <div className="expired-icon-small">⏰</div>
              <span className="header-title">Session Expired</span>
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
        <header className="chat-header">
          <div className="header-content">
            <div className="header-left">
              <div className="error-icon-small">⚠️</div>
              <span className="header-title">Error</span>
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

      {/* Header */}
      <header className="chat-header">
        <div className="header-content">
          <div className="header-left">
            <a
              href={sessionData.url}
              className="back-icon-btn"
              title="Back to profile"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>

            {sessionData.agent.operator_profile_image ? (
              <img
                src={sessionData.agent.operator_profile_image}
                alt={sessionData.agent.name}
                className="agent-avatar"
              />
            ) : (
              <div className="agent-avatar-placeholder">
                {sessionData.agent.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="agent-info">
              <h1 className="agent-name">{sessionData.agent.name}</h1>
              <span className="agent-status">Online</span>
            </div>
          </div>

          <div className="header-right">
            <div className="user-profile">
              <div className="user-avatar-header">
                {sessionData.customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info-header">
                <span className="user-name-header">You: {sessionData.customer.name}</span>
              </div>
            </div>

            <button
              onClick={openEndChatModal}
              className="end-chat-btn"
              disabled={isEndingChat}
              title="End Chat"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Chat
            </button>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {/* Welcome Section - Only show if no messages and not loading history */}
        {messages.length === 0 && !isLoadingHistory && (
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
            {isLoadingHistory ? (
              <div className="loading-history">
                <div className="spinner"></div>
                <p>Loading chat history...</p>
              </div>
            ) : messages.length > 0 ? (
              <div className="messages-list">
                {/* Show history divider if we have historical messages */}
                {historyLoaded && messages.some(m => m.isHistorical) && (
                  <div className="history-divider">
                    <span>Previous Messages</span>
                  </div>
                )}

                <ChatMessages
                  messages={messages}
                  agentName={sessionData.agent.name}
                  isTyping={isTyping}
                />
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="empty-state">
                <p>No messages yet. Start speaking to begin!</p>
              </div>
            )}

            {(isProcessing || isTyping) && (
              <div className="processing-indicator">
                {/* Typing indicator handled in ChatMessages component */}
              </div>
            )}
          </div>

          {/* Voice Recorder Section */}
          <div className="recorder-section">
            <VoiceRecorder
              onVoiceData={handleVoiceData}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              disabled={isProcessing || isSessionExpired || isLoadingHistory}
            />
          </div>
        </div>
      </main>

      {/* End Chat Confirmation Modal */}
      {showEndChatModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-icon-warning">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2>End Chat Session?</h2>
            <p>Are you sure you want to end this chat? This action cannot be undone.</p>

            <div className="modal-actions">
              <button
                onClick={closeEndChatModal}
                className="modal-btn-cancel"
                disabled={isEndingChat}
              >
                Cancel
              </button>
              <button
                onClick={handleEndChat}
                className="modal-btn-confirm"
                disabled={isEndingChat}
              >
                {isEndingChat ? (
                  <>
                    <div className="spinner-small"></div>
                    Ending...
                  </>
                ) : (
                  'Yes, End Chat'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}