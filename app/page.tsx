'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Optionally redirect to a default chat or show error
    // For now, we'll just show the error page
  }, []);

  return (
    <div className="error-page">
      <header className="chat-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-icon-home">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div className="agent-info">
              <h1 className="agent-name">VoiceChat AI</h1>
              <span className="agent-status-error">Session Missing</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-container">
        <div className="error-container">
          <div className="error-icon-large">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2>No Session Found</h2>
          <p className="error-description">
            No chat session ID provided in the URL.
          </p>
          <div className="error-help-box">
            <p className="error-help-title">How to access a chat:</p>
            <p className="error-help-text">
              Please use a valid chat URL format:
            </p>
            <code className="error-help-code">
              {process.env.NEXT_PUBLIC_CHAT_SITE_URL || 'https://yoursite.com'}/your-session-id
            </code>
          </div>
          
          <div className="error-info-cards">
            <div className="info-card">
              <div className="info-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>Need Help?</h3>
              <p>Contact your administrator to get a valid chat session link.</p>
            </div>
            
            <div className="info-card">
              <div className="info-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>Valid Session</h3>
              <p>Each chat session has a unique ID provided by your operator.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}