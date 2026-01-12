// app/components/ChatMessages.tsx
'use client';
import { Message } from '../types/chat';
import { useRef, useState } from 'react';

interface ChatMessagesProps {
  messages: Message[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </>
  );
}

function MessageItem({ message }: { message: Message }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>('');

  // Check if message is an error message
  const isErrorMessage = message.type === 'assistant' && 
    (message.content.includes('⚠️') || 
     message.content.includes('Sorry') ||
     message.content.includes('error') ||
     message.content.includes('🎤'));

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.log('Audio playback failed:', err.message);
          setError('Could not play audio');
        });
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className={`message message-${message.type} ${isErrorMessage ? 'message-error' : ''}`}>
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {message.type === 'user' ? 'You' : 'AI Assistant'}
          </span>
          <span className="message-time">
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
        
        <p className="message-text">{message.content}</p>
        
        {message.audioUrl && !isErrorMessage && (
          <div className="message-audio-container">
            <audio 
              ref={audioRef}
              src={message.audioUrl}
              onEnded={handleEnded}
              onError={(e) => {
                console.log('Audio loading error');
                setError('Audio playback error');
              }}
            />
            <button 
              onClick={playAudio}
              className={`audio-play-button ${isPlaying ? 'playing' : ''}`}
              disabled={isPlaying}
            >
              {isPlaying ? (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                  <span>Playing...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <span>Play Audio</span>
                </>
              )}
            </button>
            {error && <span className="audio-error">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}