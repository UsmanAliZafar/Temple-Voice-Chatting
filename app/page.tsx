'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const chatSiteUrl = process.env.NEXT_PUBLIC_CHAT_SITE_URL || 'https://phonetalktemple.com';

  useEffect(() => {
    const sessionString = localStorage.getItem("session");
    if (sessionString) {
      router.replace('/session');
    } else {
      window.location.href = chatSiteUrl;
    }
  }, [router]);

  return (
    <div className="error-page">
      <main className="main-container" style={{ height: "100vh" }}>
        <div className="error-container" style={{ height: "100%" }}>
          <svg width="300" height="300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 7L22 11L18 15" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
            </path>
            <path d="M22 11H14" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.2s" />
            </path>
            <path d="M6 17L2 13L6 9" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.4s" />
            </path>
            <path d="M2 13H10" stroke="#10b981" strokeWidth="2" strokeLinecap="round">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.6s" />
            </path>
          </svg>
        </div>
      </main>
    </div>
  );
}