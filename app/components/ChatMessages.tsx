// app/components/ChatMessages.tsx
'use client';
import { Message } from '../types/chat';
import { useRef, useState, useEffect } from 'react';

interface ChatMessagesProps {
  messages: Message[];
  agentName?: string;
  isTyping?: boolean;
}
export default function ChatMessages({ messages, agentName, isTyping }: ChatMessagesProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} agentName={agentName} />
      ))}
      {/* Typing Indicator */}
      {isTyping && (
        <div className="message message-assistant">
          <div className="message-content">
            <div className="message-header">
              <span className="message-sender">{agentName || 'Operator'}</span>
            </div>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageItem({ message, agentName }: { message: Message; agentName?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isErrorMessage = message.type === 'assistant' && 
    (message.content.includes('⚠️') || 
     message.content.includes('Sorry') ||
     message.content.includes('error') ||
     message.content.includes('🎤'));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.log('Audio playback failed:', err.message);
            setError('Could not play audio');
          });
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const skipTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.75, 1, 1.25, 1.5, 2];

  // Render status ticks
  const renderStatusTicks = () => {
    if (message.type !== 'user') return null;
    
    return (
      <span className="message-status">
        {message.status === 'sending' && (
          <svg className="status-icon status-sending" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        )}
        {message.status === 'delivered' && (
          <svg className="status-icon status-delivered" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        )}
        {message.status === 'seen' && (
          <svg className="status-icon status-seen" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            <path d="M10.854 6.646a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L6 10.793l3.646-3.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className={`message message-${message.type} ${isErrorMessage ? 'message-error' : ''}`}>
      <div className="message-content">
        <div className="message-header">
          <span className="message-sender">
            {message.type === 'user' ? 'You' : agentName || 'Operator'}
          </span>
          <span className="message-time">
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
            {renderStatusTicks()}
          </span>
        </div>
        
        <p className="message-text">{message.content}</p>
        
        {message.audioUrl && !isErrorMessage && (
          <div className="audio-player-compact">
            <audio 
              ref={audioRef}
              src={message.audioUrl}
              onEnded={handleEnded}
              onError={(e) => {
                console.log('Audio loading error');
                setError('Audio playback error');
                setIsLoading(false);
              }}
              preload="metadata"
            />
            
            {/* Compact Player */}
            <div className="audio-player-main">
              {/* Play Button & Progress in one line */}
              <div className="audio-player-row">
                <button 
                  onClick={togglePlay}
                  className="audio-play-compact"
                  disabled={isLoading}
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isLoading ? (
                    <div className="audio-spinner" />
                  ) : isPlaying ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4h4v16H6zm8 0h4v16h-4z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>

                {/* Progress Bar with Time */}
                <div className="audio-progress-wrapper">
                  <div className="audio-progress-track">
                    <div 
                      className="audio-progress-bar" 
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="audio-progress-input"
                      disabled={isLoading}
                    />
                  </div>
                  <span className="audio-time-compact">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Quick Controls */}
                <div className="audio-quick-controls">
                  <button 
                    onClick={() => skipTime(-10)}
                    className="audio-btn-icon"
                    disabled={isLoading}
                    title="Back 10s"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => skipTime(10)}
                    className="audio-btn-icon"
                    disabled={isLoading}
                    title="Forward 10s"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    </svg>
                  </button>

                  <button 
                    onClick={() => setShowControls(!showControls)}
                    className={`audio-btn-icon ${showControls ? 'active' : ''}`}
                    title="More options"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expandable Advanced Controls */}
              {showControls && (
                <div className="audio-advanced-compact">
                  <div className="audio-control-row">
                    <span className="audio-label">Speed</span>
                    <div className="audio-speed-compact">
                      {speedOptions.map(speed => (
                        <button
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`audio-speed-option ${playbackSpeed === speed ? 'active' : ''}`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="audio-control-row">
                    <span className="audio-label">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        {volume === 0 ? (
                          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        ) : (
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
                        )}
                      </svg>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="audio-volume-input"
                    />
                    <span className="audio-volume-text">{Math.round(volume * 100)}%</span>
                  </div>

                  <a 
                    href={message.audioUrl} 
                    download={`audio-${message.id}.mp3`}
                    className="audio-download-compact"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/>
                    </svg>
                    Download
                  </a>
                </div>
              )}

              {error && <span className="audio-error-compact">{error}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}