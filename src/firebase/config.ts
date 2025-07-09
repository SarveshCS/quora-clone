import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Debug: Check if environment variables are loaded
console.log('Firebase env check:', {
  apiToken: import.meta.env.VITE_FIREBASE_API_TOKEN ? 'loaded' : 'missing',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'loaded' : 'missing',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'loaded' : 'missing',
});

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_TOKEN,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate configuration
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error('Firebase configuration is incomplete. Please check your environment variables.');
  throw new Error('Firebase configuration is incomplete');
}

// Initialize Firebase app first
let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase app:', error);
  throw error;
}

// Initialize Firebase services with proper types
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

console.log('All Firebase services initialized successfully');

export { auth, db, storage, googleProvider };
export default app;