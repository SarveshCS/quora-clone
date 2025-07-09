import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import { setDoc, doc, query, collection, where, getDocs } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Username validation: Discord-style (alphanumeric, underscores, 3-20 chars)
  const validateUsername = (name: string) => /^[a-zA-Z0-9_]{3,20}$/.test(name);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email.trim()) {
      return setError('Please enter an email address');
    }

    if (!password.trim()) {
      return setError('Please enter a password');
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters long');
    }

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    if (!displayName.trim()) {
      return setError('Please enter a display name');
    }

    if (!username.trim()) {
      return setError('Please enter a username');
    }

    if (!validateUsername(username)) {
      return setError('Username must be 3-20 characters, only letters, numbers, and underscores');
    }

    // Check if username is unique
    try {
      setError('');
      setLoading(true);
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setLoading(false);
        return setError('Username is already taken.');
      }
      // Create user in Firebase Auth
      const userCredential = await signup(email, password);
      const user = userCredential.user;
      // Set displayName in Firebase Auth profile
      await updateProfile(user, { displayName });
      // Store user profile in Firestore (never store or expose email in UI)
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username,
        displayName,
        createdAt: new Date(),
        photoURL: user.photoURL || '',
        // email is stored for internal use only, never shown in UI
        email: user.email || '',
      });
      navigate('/');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      
      // Extract meaningful error message from Firebase
      let errorMessage = 'Failed to create an account';
      
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string; message?: string };
        switch (firebaseError.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already registered. Please use a different email or try signing in.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please choose a stronger password (at least 6 characters).';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your internet connection and try again.';
            break;
          default:
            errorMessage = firebaseError.message || 'Failed to create an account. Please try again.';
        }
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = (err as { message: string }).message;
      }
      
      setError(errorMessage);
    }
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError('Failed to sign up with Google');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create a new account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your existing account
            </Link>
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="display-name" className="sr-only">
                Display Name
              </label>
              <input
                id="display-name"
                name="displayName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Display Name (public)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Username (no spaces, unique)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="sr-only">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Sign up
            </button>
          </div>
        </form>
        
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleGoogleSignup}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" width="24" height="24">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path
                    fill="#4285F4"
                    d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.28426 53.749 C -8.52426 55.229 -9.21677 56.479 -10.0802 57.329 L -10.0802 60.609 L -6.27596 60.609 C -4.16496 58.619 -3.264 55.989 -3.264 51.509 Z"
                  />
                  <path
                    fill="#34A853"
                    d="M -14.754 63.239 C -11.514 63.239 -8.80446 62.159 -6.71596 60.609 L -10.0852 57.329 C -11.1252 58.199 -12.545 58.749 -14.754 58.749 C -17.514 58.749 -19.8945 57.099 -20.8645 54.619 L -24.7845 54.619 L -24.7845 58.029 C -22.6145 62.339 -18.924 63.239 -14.754 63.239 Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M -20.8645 54.619 C -21.2545 53.539 -21.4645 52.379 -21.4645 51.179 C -21.4645 49.979 -21.2545 48.819 -20.8645 47.739 L -20.8645 44.329 L -24.7845 44.329 C -25.9445 46.709 -26.5645 49.359 -26.5645 52.179 C -26.5645 54.999 -25.9445 57.649 -24.7845 60.029 L -24.7845 60.059 L -20.8645 54.619 Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M -14.754 43.609 C -12.5645 43.609 -10.6345 44.359 -9.04496 45.759 L -6.01596 42.689 C -8.45646 40.439 -11.514 39.119 -14.754 39.119 C -18.924 39.119 -22.6145 41.009 -24.7845 44.329 L -20.8645 47.739 C -19.8945 45.259 -17.514 43.609 -14.754 43.609 Z"
                  />
                </g>
              </svg>
              Sign up with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
