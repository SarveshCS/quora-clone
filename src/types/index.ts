// User related types
export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  isAnonymous: boolean;
  metadata: {
    creationTime?: string;
    lastSignInTime?: string;
  };
  providerData: Array<{
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
  }>;
  refreshToken: string;
}

export interface UserProfile extends Omit<User, 'metadata' | 'providerData' | 'refreshToken'> {
  username?: string;
  bio?: string;
  website?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
  followersCount: number;
  followingCount: number;
  questionsCount: number;
  answersCount: number;
  upvotesReceived: number;
}

// Question related types
export interface Question {
  id: string;
  title: string;
  content: string;
  author: {
    uid: string;
    displayName: string;
    photoURL?: string;
  };
  tags: string[];
  votes: number;
  answers: number;
  views: number;
  isAnswered: boolean;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  featuredAt?: Date;
  bounty?: number;
}

// Answer related types
export interface Answer {
  id: string;
  content: string;
  questionId: string;
  questionTitle: string;
  author: {
    uid: string;
    displayName: string;
    photoURL?: string;
  };
  votes: number;
  isAccepted: boolean;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Comment related types
export interface Comment {
  id: string;
  content: string;
  author: {
    uid: string;
    displayName: string;
    photoURL?: string;
  };
  parentId: string; // ID of the question or answer
  parentType: 'question' | 'answer';
  createdAt: Date;
  updatedAt: Date;
}

// Vote related types
export interface Vote {
  id: string;
  userId: string;
  value: 1 | -1; // 1 for upvote, -1 for downvote
  createdAt: Date;
}

export interface QuestionVote extends Vote {
  questionId: string;
}

export interface AnswerVote extends Vote {
  answerId: string;
}

// Tag related types
export interface Tag {
  id: string;
  name: string;
  description?: string;
  questionsCount: number;
  followersCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Notification related types
export type NotificationType = 
  | 'new_answer'
  | 'answer_accepted'
  | 'new_comment'
  | 'new_follower'
  | 'mention'
  | 'bounty_awarded'
  | 'moderation_action';

export interface Notification {
  id: string;
  type: NotificationType;
  recipientId: string;
  sender: {
    uid: string;
    displayName: string;
    photoURL?: string;
  };
  content: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
}

// Search related types
export interface SearchResult {
  questions: Question[];
  answers: Answer[];
  users: UserProfile[];
  tags: Tag[];
  total: number;
  hasMore: boolean;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Form related types
export interface FormField<T> {
  value: T;
  error?: string;
  touched: boolean;
  validate: (value: T) => string | undefined;
}

// Authentication related types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Route related types
export interface RouteConfig {
  path: string;
  component: React.ComponentType<any>;
  exact?: boolean;
  isPrivate?: boolean;
  roles?: string[];
  layout?: React.ComponentType<any>;
}

// API error response
export interface ApiError extends Error {
  code: string;
  status?: number;
  details?: any;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// File upload types
export interface FileUpload {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

// Rich text editor types
export type EditorContent = {
  type: 'doc';
  content: any[];
};

// Analytics event types
export type AnalyticsEvent = {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
  userId?: string;
};
