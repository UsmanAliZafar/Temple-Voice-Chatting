'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
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
    if (landing_key && landing_key != "session") {
      localStorage.removeItem('landing_key');
      localStorage.setItem('landing_key', landing_key);
      router.replace('/session');
    }
  }, [landing_key, router]);

  useEffect(() => {
    fetchSessionData();
  }, []);

  const fetchSessionData = async () => {
    const sessionString = localStorage.getItem("session");
    if (sessionString) {
      const session = JSON.parse(sessionString) as SessionData;
      console.log("Current session: ");
      console.log(session);
      setSessionData(session);
      setIsLoading(false);
    } else {
      try {
        setIsLoading(true);
        setError('');
        setIsSessionExpired(false);
        setErrorType(null);
        const landing_key = localStorage.getItem('landing_key');
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
          localStorage.removeItem('landing_key');
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
        localStorage.removeItem('session');
        localStorage.setItem("session", JSON.stringify(data));
      } catch (error: any) {
        console.error('Error fetching session data:', error);
        setError(error.message || 'Failed to load session');
        setErrorType('error');
        setErrorMessage(error.message || 'Failed to load session');
        setIsLoading(false);
      }
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

    const typingDelay = getRandomDelay(1000, 5000);
    setIsTyping(true);

    // Simulate delivery status (12-20 seconds)
    setMessages(prev =>
      prev.map(msg =>
        msg.id === userMessage.id
          ? { ...msg, status: 'delivered' as const }
          : msg
      )
    );
    // Simulate seen status (15-20 seconds)
    setMessages(prev =>
      prev.map(msg =>
        msg.id === userMessage.id
          ? { ...msg, status: 'seen' as const }
          : msg
      )
    );

    try {

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.mp3');
      formData.append('session_id', sessionData.session_id);

      console.log('📡 Sending request to /api/chat...');
      const startTime = Date.now();
      setIsProcessing(true);

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

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
        localStorage.removeItem('landing_key');
        localStorage.removeItem('session');
        window.location.href = sessionData.url + "?end=session";
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
            <div className="user-profile" style={{ background: "unset", border: "unset" }}>
              Hi, {sessionData.customer.name}
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