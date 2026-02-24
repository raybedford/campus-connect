export interface Profile {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  phone_number: string | null;
  preferred_language: string;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  school_id: string;
  avatar_url: string | null;
  phone_number: string | null;
  preferred_language: string;
  is_verified: boolean;
  created_at: string;
  last_seen: string | null;
}

export interface UserSearch {
  id: string;
  email: string;
  display_name: string;
}

export interface ConversationMember {
  user_id: string;
  role: string;
  last_read_at: string;
  user: Profile;
  // Flattened fallbacks for legacy access patterns
  display_name?: string;
  email?: string;
  joined_at?: string;
}

export interface Conversation {
  id: string;
  type: 'dm' | 'group';
  name: string | null;
  school_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
}

export interface EncryptedPayload {
  recipient_id: string;
  ciphertext_b64: string;
  nonce_b64: string;
  encryptor_id?: string; // ID of the user who performed the encryption (defaults to sender_id)
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'file';
  file_url?: string;
  created_at: string;
  sender?: Profile;
  encrypted_payloads?: EncryptedPayload[];
  // Client-side decrypted content (not from server)
  decrypted_text?: string;
}

export interface PublicKeyInfo {
  id: string;
  user_id: string;
  public_key_b64: string;
  is_active: boolean;
}

export interface FileAttachment {
  id: string;
  message_id: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// WebSocket event types
export interface WsNewMessage {
  type: 'new_message';
  message: Message;
  sender_display_name: string;
}

export interface WsTyping {
  type: 'user_typing';
  conversation_id: string;
  user_id: string;
  display_name: string;
}

export interface WsPresence {
  type: 'presence';
  user_id: string;
  status: 'online' | 'offline';
}

export interface WsMessageAck {
  type: 'message_ack';
  message_id: string;
  conversation_id: string;
}

export type WsServerEvent = WsNewMessage | WsTyping | WsPresence | WsMessageAck;
