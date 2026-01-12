'use client';

import { Message } from '@/types/chat';

interface ChatMessagesProps {
  messages: Message[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[80%] rounded-2xl px-4 py-3 shadow-sm
              ${message.type === 'user'
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }
            `}
          >
            {/* Message Content */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>

            {/* Audio Player (if available) */}
            {message.audioUrl && (
              <div className="mt-2">
                <audio 
                  controls 
                  className="w-full h-8"
                  style={{ maxWidth: '300px' }}
                >
                  <source src={message.audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {/* Timestamp */}
            <p
              className={`
                text-xs mt-1
                ${message.type === 'user' ? 'text-indigo-100' : 'text-gray-500'}
              `}
            >
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}