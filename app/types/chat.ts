// types/chat.ts
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  status?: 'sending' | 'delivered' | 'seen';
  isHistorical?: boolean; // Flag for loaded history messages
}

export interface ChatState {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  error?: string;
}

export interface ChatHistoryItem {
  id: number;
  master_id: number;
  session_id: string;
  message: string | null;
  reply: string | null;
  chat_type: string | null;
  created_at: string;
  updated_at: string;
  message_id: string | null;
  audio_message: string;
  audio_reply: string;
  message_time: string;
  reply_time: string;
}