import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';

const AskQuestion = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (currentUser === null) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Show loading while checking authentication
  if (currentUser === undefined) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect if not authenticated (this shouldn't be reached due to useEffect, but just in case)
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <span className="block sm:inline">Please log in to ask a question.</span>
        </div>
      </div>
    );
  }

  const getCurrentUsername = async () => {
    if (!currentUser) return '';
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    return userDoc.exists() ? userDoc.data().username || '' : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      return setError('You must be logged in to post a question');
    }

    if (!title.trim() || !content.trim()) {
      return setError('Title and content are required');
    }

    const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean);
    
    try {
      setError('');
      setLoading(true);
      
      const username = await getCurrentUsername();
      const questionData = {
        title: title.trim(),
        content: content.trim(),
        tags: tagList,
        author: currentUser.displayName || username || 'Anonymous',
        authorId: currentUser.uid,
        username: username || '',
        votes: 0,
        answers: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'questions'), questionData);
      
      // Reset form
      setTitle('');
      setContent('');
      setTags('');
      
      navigate('/');
    } catch (err: unknown) {
      let errorMessage = 'Failed to post question. Please try again.';
      
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string; message: string };
        
        switch (firebaseError.code) {
          case 'permission-denied':
            errorMessage = 'You don\'t have permission to post questions. Please try logging in again.';
            break;
          case 'unauthenticated':
            errorMessage = 'You need to be logged in to post a question.';
            break;
          case 'unavailable':
            errorMessage = 'Service is temporarily unavailable. Please try again later.';
            break;
          default:
            errorMessage = 'Failed to post question. Please try again.';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ask a public question</h1>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Title</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Be specific and imagine you're asking a question to another person
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g. Is there an R function for finding the index of an element in a vector?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium text-gray-900">What are the details of your problem?</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Introduce the problem and expand on what you put in the title. Minimum 20 characters.
                </p>
                <div className="mt-2">
                  <textarea
                    rows={8}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                    placeholder="Please describe your question in detail..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium text-gray-900">Tags</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Add up to 5 tags to describe what your question is about (comma-separated)
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g. javascript, react, typescript"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Posting...' : 'Post Your Question'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AskQuestion;
