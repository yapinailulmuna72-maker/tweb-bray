import { Timestamp } from 'firebase/firestore';

export interface Template {
  id: string;
  name: string;
  size: '1080x1080' | '1080x1920';
  imageData: string; // base64
  createdAt: Timestamp;
  createdBy: string;
}

export interface UserProfile {
  email: string;
  role: 'admin' | 'user';
}

export interface EditorState {
  photo: string | null;
  scale: number;
  x: number;
  y: number;
  mascot?: string | null;
  mascotScale?: number;
  mascotX?: number;
  mascotY?: number;
}
