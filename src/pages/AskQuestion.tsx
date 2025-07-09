import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc, query, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase/config';
import MarkdownEditor from '../utils/MarkdownEditor';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

const AskQuestion = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Create handlers for hashtag and mention clicks
  const handleHashtagClick = createHashtagClickHandler(navigate);
  const handleMentionClick = createMentionClickHandler(navigate);

  // Redirect if not authenticated
  useEffect(() => {
    if (currentUser === null) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  // Fetch available users for mention validation
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnap = await getDocs(usersQuery);
        const users: User[] = usersSnap.docs.map(doc => ({
          uid: doc.id,
          username: doc.data().username || '',
          displayName: doc.data().displayName || ''
        })).filter(user => user.username); // Only include users with usernames
        setAvailableUsers(users);
      } catch (error) {
        console.error('Error fetching users:', error);
        setAvailableUsers([]);
      }
    };

    fetchUsers();
  }, []);

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
      <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-4 lg:px-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 sm:px-4 py-3 rounded text-sm sm:text-base">
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
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-4 lg:px-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ask a public question</h1>
      </div>
      
      {error && (
        <div className="mb-4 sm:mb-6 bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded relative text-sm sm:text-base" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="bg-white shadow rounded-lg sm:rounded-lg">
          <div className="px-3 py-4 sm:px-4 sm:py-5 lg:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-lg font-medium text-gray-900">Title</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  Be specific and imagine you're asking a question to another person
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-sm sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    placeholder="e.g. Is there an R function for finding the index of an element in a vector?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-medium text-gray-900">What are the details of your problem?</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  Introduce the problem and expand on what you put in the title. You can use markdown formatting, include images, links, hashtags (#), and mentions (@).
                </p>
                <div className="mt-2">
                  <MarkdownEditor
                    value={content}
                    onChange={setContent}
                    availableUsers={availableUsers}
                    onHashtagClick={handleHashtagClick}
                    onMentionClick={handleMentionClick}
                    placeholder="Please describe your question in detail... You can use **bold**, *italic*, `code`, [links](url), ![images](url), #hashtags, @mentions, and more!"
                    minHeight="200px"
                    maxHeight="500px"
                  />
                </div>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-medium text-gray-900">Tags</h2>
                <p className="mt-1 text-xs sm:text-sm text-gray-500">
                  Add up to 5 tags to describe what your question is about (comma-separated)
                </p>
                <div className="mt-2">
                  <input
                    type="text"
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-sm sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    placeholder="e.g. javascript, react, typescript"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto sm:ml-3 inline-flex justify-center py-2.5 sm:py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
