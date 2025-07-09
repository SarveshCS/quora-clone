import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { 
  type User, 
  type UserCredential,
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string): Promise<UserCredential> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential;
    } catch (error: unknown) {
      console.error('Signup error:', error);
      // Re-throw the original Firebase error so Register component can handle it properly
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user profile exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create a username from the email or displayName
        let baseUsername = user.email?.split('@')[0] || user.displayName?.replace(/\s+/g, '').toLowerCase() || 'user';
        baseUsername = baseUsername.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 15);
        
        // Generate a unique username
        let username = baseUsername;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (attempts < maxAttempts) {
          const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
          const usernameSnap = await getDocs(usernameQuery);
          
          if (usernameSnap.empty) {
            break; // Username is unique
          }
          
          attempts++;
          username = baseUsername + Math.floor(Math.random() * 10000);
        }
        
        // Create user profile in Firestore
        await setDoc(userDocRef, {
          uid: user.uid,
          username: username,
          displayName: user.displayName || baseUsername,
          email: user.email || '',
          photoURL: user.photoURL || '',
          createdAt: new Date(),
        });
      }
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error: unknown) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  const value = {
    currentUser,
    loading,
    login,
    signup,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
