import { auth } from '../firebase/config';

const FirebaseDiagnostic = () => {
  const checkFirebaseConfig = () => {
    console.log('=== Firebase Configuration Check ===');
    console.log('Auth instance:', auth);
    console.log('Auth app:', auth.app);
    console.log('Auth app options:', auth.app.options);
    
    // Check environment variables
    console.log('Environment Variables:');
    console.log('API Key:', import.meta.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Missing');
    console.log('Auth Domain:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
    console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID);
    console.log('Storage Bucket:', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
    console.log('Messaging Sender ID:', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
    console.log('App ID:', import.meta.env.VITE_FIREBASE_APP_ID);
    console.log('Measurement ID:', import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);
    
    // Test Firebase connection
    console.log('Current user:', auth.currentUser);
    console.log('Auth config:', auth.config);
    
    // Check if all required config is present
    const requiredVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN', 
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_APP_ID'
    ];
    
    const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars);
    } else {
      console.log('✅ All required environment variables are present');
    }
  };

  const testBasicConnection = async () => {
    try {
      console.log('Testing Firebase connection...');
      await auth.authStateReady();
      console.log('✅ Firebase Auth is ready');
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      <button
        onClick={checkFirebaseConfig}
        className="block w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-xs"
      >
        Check Config
      </button>
      <button
        onClick={testBasicConnection}
        className="block w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-xs"
      >
        Test Connection
      </button>
    </div>
  );
};

export default FirebaseDiagnostic;
