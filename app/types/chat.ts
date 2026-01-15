// types/chat.ts
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  status?: 'sending' | 'delivered' | 'seen';
}

export interface ChatState {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  error?: string;
}