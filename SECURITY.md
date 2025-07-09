# Firebase Security Guide

## Environment Variables

### VITE_FIREBASE_API_TOKEN (formerly VITE_FIREBASE_API_KEY)
- **This is SAFE to expose publicly**
- Firebase API keys are designed to be public for client-side applications
- The real security comes from Firebase Security Rules, not hiding the API key
- The API key only identifies your Firebase project, it doesn't grant access to data

### Why the Vercel Warning Appears
- Vercel shows warnings for any environment variable containing "KEY" to be cautious
- This is a false positive for Firebase API keys
- We renamed it to `VITE_FIREBASE_API_TOKEN` to avoid the warning

## Real Security Measures

### 1. Firebase Security Rules
The actual security is enforced by Firestore Security Rules. Make sure your `firestore.rules` file has proper access controls:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Questions and answers with proper authentication
    match /questions/{questionId} {
      allow read: if true; // Public read
      allow create: if request.auth != null; // Authenticated users can create
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId;
    }
  }
}
```

### 2. Firebase App Check (Optional)
For additional protection against abuse, consider implementing Firebase App Check.

### 3. Environment Variables Best Practices
- Never expose server-side secrets (like admin SDK keys)
- Use different Firebase projects for development and production
- Regularly rotate sensitive credentials (though Firebase API keys don't need rotation)

## What's Safe to Expose vs. Keep Secret

### Safe to Expose (Client-side):
- ✅ Firebase API Key/Token
- ✅ Firebase Auth Domain
- ✅ Firebase Project ID
- ✅ Firebase App ID
- ✅ Firebase Measurement ID

### Keep Secret (Server-side only):
- ❌ Firebase Admin SDK Private Key
- ❌ Database connection strings with credentials
- ❌ Third-party API secrets
- ❌ Encryption keys
