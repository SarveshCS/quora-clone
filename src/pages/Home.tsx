import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, doc, getDoc, updateDoc, increment, deleteDoc, query, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { RenderTextWithLinks } from '../utils/textRendering';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

// Custom hook for debounced value
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface QuestionRaw {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  username?: string;
  createdAt?: { seconds: number };
  votes: number;
  answers: number;
  tags: string[];
  userVotes?: { [key: string]: 'up' | 'down' };
}

interface Question {
  id: string;
  title: string;
  content: string;
  author: string; // displayName (for UI only)
  authorId: string;
  username: string; // <-- add this for username
  createdAt?: { seconds: number };
  votes: number;
  answers: number;
  tags: string[];
  userVotes?: { [key: string]: 'up' | 'down' };
}

const Home = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editQuestionId, setEditQuestionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const QUESTIONS_PER_LOAD = 10;
  
  // Create handlers for hashtag and mention clicks
  const handleHashtagClick = createHashtagClickHandler(navigate);
  const handleMentionClick = createMentionClickHandler(navigate);
  
  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Initial load
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError('');
        
        const q = query(
          collection(db, 'questions'),
          orderBy('createdAt', 'desc'),
          limit(QUESTIONS_PER_LOAD)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.docs.length === 0) {
          setQuestions([]);
          setHasMore(false);
          return;
        }
        
        // Fetch all user profiles for missing usernames
        const questionsDataRaw = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuestionRaw[];
        const missingUsername = questionsDataRaw.filter(q => !q.username && q.authorId);
        const userMap: Record<string, string> = {};
        
        if (missingUsername.length > 0) {
          const userDocs = await Promise.all(missingUsername.map(q => getDoc(doc(db, 'users', q.authorId))));
          userDocs.forEach((userDoc, idx) => {
            if (userDoc.exists()) {
              userMap[missingUsername[idx].authorId] = userDoc.data().username || '';
            }
          });
        }
        
        const questionsData = questionsDataRaw.map(q => ({
          ...q,
          username: q.username || userMap[q.authorId] || 'unknown',
        })) as Question[];
        
        setQuestions(questionsData);
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMore(querySnapshot.docs.length === QUESTIONS_PER_LOAD);
        
      } catch (error) {
        console.error('Error fetching questions:', error);
        
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as { code: string; message: string };
          if (firebaseError.code === 'permission-denied') {
            setError('Unable to load questions. Please check your connection and try again.');
          } else if (firebaseError.code === 'unavailable') {
            setError('Service is temporarily unavailable. Please try again later.');
          } else {
            setError('Failed to load questions. Please try again.');
          }
        } else {
          setError('Failed to load questions. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

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

  // Load more questions
  const loadMoreQuestions = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'questions'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(QUESTIONS_PER_LOAD)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length === 0) {
        setHasMore(false);
        return;
      }
      
      // Fetch usernames for new questions
      const questionsDataRaw = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QuestionRaw[];
      const missingUsername = questionsDataRaw.filter(q => !q.username && q.authorId);
      const userMap: Record<string, string> = {};
      
      if (missingUsername.length > 0) {
        const userDocs = await Promise.all(missingUsername.map(q => getDoc(doc(db, 'users', q.authorId))));
        userDocs.forEach((userDoc, idx) => {
          if (userDoc.exists()) {
            userMap[missingUsername[idx].authorId] = userDoc.data().username || '';
          }
        });
      }
      
      const questionsData = questionsDataRaw.map(q => ({
        ...q,
        username: q.username || userMap[q.authorId] || 'unknown',
      })) as Question[];
      
      setQuestions(prev => [...prev, ...questionsData]);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === QUESTIONS_PER_LOAD);
      
    } catch (error) {
      console.error('Error loading more questions:', error);
      setError('Failed to load more questions. Please try again.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreQuestions();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMoreQuestions]);

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

  // Handle voting
  const handleVote = async (questionId: string, vote: 'up' | 'down') => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    try {
      const questionRef = doc(db, 'questions', questionId);
      const questionSnap = await getDoc(questionRef);
      
      if (!questionSnap.exists()) return;
      
      const data = questionSnap.data();
      const userVotes = data.userVotes || {};
      const currentVote = userVotes[currentUser.uid];
      
      let voteChange = 0;
      const newUserVotes = { ...userVotes };
      
      if (currentVote === vote) {
        // Remove vote if clicking same button
        delete newUserVotes[currentUser.uid];
        voteChange = vote === 'up' ? -1 : 1;
      } else if (currentVote) {
        // Change vote
        newUserVotes[currentUser.uid] = vote;
        voteChange = vote === 'up' ? 2 : -2;
      } else {
        // New vote
        newUserVotes[currentUser.uid] = vote;
        voteChange = vote === 'up' ? 1 : -1;
      }
      
      await updateDoc(questionRef, {
        votes: increment(voteChange),
        userVotes: newUserVotes
      });
      
      // Update local state immediately for better UX
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.id === questionId 
            ? { 
                ...q, 
                votes: (q.votes || 0) + voteChange,
                userVotes: newUserVotes
              }
            : q
        )
      );
      
    } catch (err) {
      console.error('Error voting:', err);
      setError('Failed to process vote. Please try again.');
      setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
    }
  };

  // Edit Question
  const handleEditQuestion = (question: Question) => {
    setEditQuestionId(question.id);
    setEditTitle(question.title);
    setEditContent(question.content);
  };
  const handleSaveEdit = async (questionId: string) => {
    try {
      await updateDoc(doc(db, 'questions', questionId), {
        title: editTitle,
        content: editContent
      });
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, title: editTitle, content: editContent } : q));
      setEditQuestionId(null);
    } catch {
      setError('Failed to update question');
    }
  };
  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteDoc(doc(db, 'questions', questionId));
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      setDeleteConfirmId(null);
    } catch {
      setError('Failed to delete question');
    }
  };

  // Memoize filtered questions to avoid recalculating on every render
  const filteredQuestions = useMemo(() => {
    if (!debouncedSearchTerm) return questions;
    
    return questions.filter(question =>
      question.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      question.content.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (question.tags && question.tags.some(tag => tag.toLowerCase().includes(debouncedSearchTerm.toLowerCase())))
    );
  }, [questions, debouncedSearchTerm]);

  // Memoize date formatting function
  const formatDate = useCallback((timestamp?: { seconds: number }) => {
    if (!timestamp) return 'Unknown date';
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Loading questions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <h3 className="font-bold">Unable to Load Questions</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-0">
      {/* Mobile-friendly search bar */}
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <form onSubmit={handleSearch} className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
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
            className="block w-full pl-9 sm:pl-10 pr-3 py-3 sm:py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Search questions... (Press Enter to search)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
        </form>
      </div>

      <div className="space-y-3 sm:space-y-4 lg:space-y-6">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <h3 className="mt-2 text-lg font-medium text-gray-900">No questions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Be the first to ask a question!
            </p>
            <div className="mt-4 sm:mt-6">
              <Link
                to="/ask"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ask a Question
              </Link>
            </div>
          </div>
        ) : (
          <>
            {filteredQuestions.map((question) => (
              <div key={question.id} className="bg-white shadow overflow-hidden rounded-lg sm:rounded-lg border sm:border-0">
                <div className="px-3 py-4 sm:px-6 sm:py-5">
                  <div className="flex items-start space-x-3 sm:space-x-4">
                    {/* Mobile-optimized voting section */}
                    <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                      <button 
                        onClick={() => handleVote(question.id, 'up')}
                        className={`p-1.5 sm:p-2 rounded-full transition-colors ${
                          !currentUser 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : question.userVotes?.[currentUser.uid] === 'up' 
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' 
                              : 'text-gray-500 hover:text-blue-600 hover:bg-gray-50'
                        }`}
                        title={!currentUser ? "Login to vote" : "Upvote"}
                        disabled={!currentUser}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      <span className="text-sm sm:text-lg font-semibold text-gray-700 min-w-[24px] text-center">
                        {question.votes || 0}
                      </span>
                      
                      <button 
                        onClick={() => handleVote(question.id, 'down')}
                        className={`p-1.5 sm:p-2 rounded-full transition-colors ${
                          !currentUser 
                            ? 'text-gray-300 cursor-not-allowed' 
                            : question.userVotes?.[currentUser.uid] === 'down' 
                              ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                              : 'text-gray-500 hover:text-red-600 hover:bg-gray-50'
                        }`}
                        title={!currentUser ? "Login to vote" : "Downvote"}
                        disabled={!currentUser}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      {editQuestionId === question.id ? (
                        <>
                          <input
                            className="w-full border rounded-md p-3 sm:p-2 mb-3 sm:mb-2 text-sm"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            maxLength={100}
                            placeholder="Question title"
                          />
                          <textarea
                            className="w-full border rounded-md p-3 sm:p-2 mb-3 sm:mb-2 text-sm"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={4}
                            maxLength={1000}
                            placeholder="Question details"
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors" onClick={() => handleSaveEdit(question.id)}>
                              Save Changes
                            </button>
                            <button className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 transition-colors" onClick={() => setEditQuestionId(null)}>
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Link to={`/question/${question.id}`} className="block group">
                            <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900 group-hover:text-blue-600 whitespace-pre-wrap break-words">
                              <RenderTextWithLinks
                                text={question.title}
                                availableUsers={availableUsers}
                                onHashtagClick={handleHashtagClick}
                                onMentionClick={handleMentionClick}
                              />
                            </h3>
                          </Link>
                          
                          {/* Mobile-stacked metadata */}
                          <div className="mt-2 space-y-1 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-x-6">
                            <div className="flex items-center text-xs sm:text-sm text-gray-500">
                              <span>Asked by </span>
                              <Link to={`/@${question.username}`} className="ml-1 text-blue-600 hover:underline font-medium">
                                @{question.username || 'unknown'}
                              </Link>
                            </div>
                            <div className="flex items-center justify-between sm:justify-start sm:gap-x-6">
                              <span className="text-xs sm:text-sm text-gray-500">{formatDate(question.createdAt)}</span>
                              <span className="text-xs sm:text-sm text-gray-500">{question.answers || 0} answers</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 text-sm text-gray-600 line-clamp-3 sm:line-clamp-2 whitespace-pre-wrap break-words">
                            <RenderTextWithLinks
                              text={question.content}
                              availableUsers={availableUsers}
                              onHashtagClick={handleHashtagClick}
                              onMentionClick={handleMentionClick}
                            />
                          </div>
                          
                          {currentUser?.displayName && currentUser.uid === question.authorId && (
                            <div className="flex gap-3 mt-3 pt-2 border-t border-gray-100">
                              <button 
                                onClick={() => handleEditQuestion(question)}
                                className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                                title="Edit question"
                              >
                                <FiEdit className="h-4 w-4" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(question.id)}
                                className="flex items-center gap-1 text-red-500 hover:text-red-700 text-sm transition-colors"
                                title="Delete question"
                              >
                                <FiTrash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {/* Delete Confirmation Modal - Mobile-friendly */}
                {deleteConfirmId === question.id && (
                  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg max-w-sm w-full">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">Delete Question</h3>
                      <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this question? This action cannot be undone.</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button 
                          className="w-full sm:w-auto bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors" 
                          onClick={() => handleDeleteQuestion(question.id)}
                        >
                          Delete
                        </button>
                        <button 
                          className="w-full sm:w-auto bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 transition-colors" 
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {loadingMore ? (
                  <LoadingSpinner message="Loading more questions..." />
                ) : (
                  <div className="text-gray-500 text-sm">Scroll down to load more...</div>
                )}
              </div>
            )}
            
            {!hasMore && questions.length > 0 && (
              <div className="text-center py-6 text-gray-500 text-sm">
                You've reached the end! No more questions to load.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Home;
