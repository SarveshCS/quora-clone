import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  browserLocalPersistence, 
  type Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  type Firestore 
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Check if Firebase is already initialized to avoid duplicate apps
if (!getApps().length) {
  try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Set auth persistence
    auth.setPersistence(browserLocalPersistence).catch((error) => {
      console.error('Error setting auth persistence:', error);
    });

    // Enable offline persistence for Firestore
    if (typeof window !== 'undefined') { // Only in browser
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support all of the features required to enable persistence.');
        } else {
          console.error('Error enabling persistence:', err);
        }
      });
    }

    // Log successful initialization
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error; // Rethrow to prevent app from starting with broken Firebase
  }
} else {
  // Use existing app instance
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
}

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

// Export initialized services
export { auth, db };
export default app;
