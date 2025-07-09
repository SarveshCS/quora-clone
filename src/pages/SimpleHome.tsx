import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/LoadingSpinner';
import { RenderTextWithLinks } from '../utils/textRendering';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

interface SimpleQuestion {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt?: { seconds: number };
  votes?: number;
  answers?: number;
  tags?: string[];
}

const SimpleHome = () => {
  const [questions, setQuestions] = useState<SimpleQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  // Create handlers for hashtag and mention clicks
  const handleHashtagClick = createHashtagClickHandler(navigate);
  const handleMentionClick = createMentionClickHandler(navigate);

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

  // Handle search - navigate to search page
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}&type=questions`);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e as React.FormEvent);
    }
  };

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        console.log('🔄 SimpleHome: Starting to fetch questions...');
        setLoading(true);
        setError('');
        
        const questionsRef = collection(db, 'questions');
        console.log('📝 SimpleHome: Questions collection reference created');
        
        // Simple query without orderBy to avoid index issues
        const querySnapshot = await getDocs(questionsRef);
        console.log('✅ SimpleHome: Query executed successfully');
        console.log('📊 SimpleHome: Number of documents found:', querySnapshot.docs.length);
        
        const questionsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as SimpleQuestion[];
        
        // Sort on client side if needed
        questionsData.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });
        
        // Limit to 10 for testing
        const limitedQuestions = questionsData.slice(0, 10);
        
        console.log('🎯 SimpleHome: Processed questions:', limitedQuestions.length);
        setQuestions(limitedQuestions);
        
      } catch (error) {
        console.error('❌ SimpleHome: Error fetching questions:', error);
        setError('Failed to load questions. Please check the console for details.');
      } finally {
        console.log('🏁 SimpleHome: Setting loading to false');
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Loading questions (Simple Mode)..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h3 className="font-bold">Error Loading Questions</h3>
          <p>{error}</p>
          <p className="mt-2 text-sm">Check the browser console for more details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions (Simple Mode)</h2>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search questions... (Press Enter to search)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
        </form>
        
        <p className="text-sm text-gray-600">Found {questions.length} questions</p>
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900">No questions found</h3>
            <p className="text-sm text-gray-500">Be the first to ask a question!</p>
            <div className="mt-6">
              <Link
                to="/ask"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                Ask a Question
              </Link>
            </div>
          </div>
        ) : (
          questions.map((question) => (
            <div key={question.id} className="bg-white shadow overflow-hidden sm:rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 whitespace-pre-wrap">
                <RenderTextWithLinks
                  text={question.title || 'Untitled Question'}
                  availableUsers={availableUsers}
                  onHashtagClick={handleHashtagClick}
                  onMentionClick={handleMentionClick}
                />
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                By: {question.author || 'Anonymous'}
              </p>
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                <RenderTextWithLinks
                  text={question.content ? 
                    (question.content.length > 150 ? question.content.substring(0, 150) + '...' : question.content) 
                    : 'No content available'
                  }
                  availableUsers={availableUsers}
                  onHashtagClick={handleHashtagClick}
                  onMentionClick={handleMentionClick}
                />
              </p>
              <div className="mt-2 text-xs text-gray-500">
                ID: {question.id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SimpleHome;
