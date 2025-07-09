import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  increment,
  writeBatch,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { RenderTextWithLinks } from '../utils/textRendering';
import MarkdownEditor from '../utils/MarkdownEditor';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

interface Question {
  id: string;
  title: string;
  content: string;
  author: string; // displayName (for UI only)
  authorId: string;
  username: string; // <-- add this for username
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  votes: number;
  tags: string[];
  answers: number;
  userVotes?: {
    [key: string]: 'up' | 'down';
  };
}

interface Answer {
  id: string;
  content: string;
  author: string;
  userId: string;
  username: string; // <-- add this for username
  questionId: string;
  questionTitle: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
  votes: number;
  isAccepted: boolean;
  userVotes?: {
    [key: string]: 'up' | 'down';
  };
}

const QuestionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [answerContent, setAnswerContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editQuestionMode, setEditQuestionMode] = useState(false);
  const [editQuestionContent, setEditQuestionContent] = useState('');
  const [editAnswerId, setEditAnswerId] = useState<string | null>(null);
  const [editAnswerContent, setEditAnswerContent] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'question' | 'answer', id: string } | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Create handlers for hashtag and mention clicks
  const handleHashtagClick = createHashtagClickHandler(navigate);
  const handleMentionClick = createMentionClickHandler(navigate);

  // Check URL for auto-edit parameters and set content when data loads
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const autoEdit = searchParams.get('autoEdit');
    const autoEditType = searchParams.get('autoEditType');
    const autoEditId = searchParams.get('autoEditId');
    
    if (autoEdit === 'true' && autoEditType && autoEditId) {
      if (autoEditType === 'question' && question) {
        setEditQuestionContent(question.content);
        setEditQuestionMode(true);
      } else if (autoEditType === 'answer' && answers.length > 0) {
        const answerToEdit = answers.find(a => a.id === autoEditId);
        if (answerToEdit) {
          setEditAnswerContent(answerToEdit.content);
          setEditAnswerId(autoEditId);
        }
      }
      
      // Clean up URL after setting edit mode
      const newURL = window.location.pathname;
      window.history.replaceState({}, '', newURL);
    }
  }, [location.search, question, answers]);

  useEffect(() => {
    if (!id) return;

    let questionUnsubscribe: (() => void) | undefined;
    let answersUnsubscribe: (() => void) | undefined;

    // Helper to fetch username from users collection
    const fetchUsernameById = async (uid: string) => {
      if (!uid) return '';
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        return userDoc.exists() ? userDoc.data().username || '' : '';
      } catch {
        return '';
      }
    };

    try {
      // Set up real-time listener for the question
      const questionRef = doc(db, 'questions', id);
      questionUnsubscribe = onSnapshot(questionRef, async (docSnap) => {
        if (!docSnap.exists()) {
          navigate('/404', { replace: true });
          return;
        }
        const data = docSnap.data();
        let username = data.username || '';
        if (!username && data.authorId) {
          username = await fetchUsernameById(data.authorId);
        }
        setQuestion({
          id: docSnap.id,
          ...data,
          username: username || '',
        } as Question);
        setLoading(false);
      }, (error) => {
        console.error('Error listening to question:', error);
        setError('Failed to load question');
        setLoading(false);
        setTimeout(() => setError(''), 5000);
      });

      // Set up real-time listener for answers
      const answersQuery = query(
        collection(db, 'answers'),
        where('questionId', '==', id)
      );
      answersUnsubscribe = onSnapshot(answersQuery, async (snapshot) => {
        const answersData = await Promise.all(snapshot.docs.map(async docSnap => {
          const data = docSnap.data();
          let username = data.username || '';
          if (!username && data.userId) {
            username = await fetchUsernameById(data.userId);
          }
          return {
            id: docSnap.id,
            ...data,
            username: username || '',
          } as Answer;
        }));
        // Sort answers client-side (newest first)
        answersData.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          return 0;
        });
        setAnswers(answersData);
      }, (error) => {
        console.error('Error listening to answers:', error);
        setError('Failed to load answers');
        setTimeout(() => setError(''), 5000);
      });
    } catch (err) {
      console.error('Error setting up listeners:', err);
      setError('Failed to load question');
      setLoading(false);
    }
    return () => {
      if (questionUnsubscribe) questionUnsubscribe();
      if (answersUnsubscribe) answersUnsubscribe();
    };
  }, [id, navigate]);

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

  // Helper to get username for current user
  const getCurrentUsername = async () => {
    if (!currentUser) return '';
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    return userDoc.exists() ? userDoc.data().username || '' : '';
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answerContent.trim()) {
      setError('Answer cannot be empty');
      return;
    }
    
    if (!currentUser) {
      navigate('/login', { state: { from: `/question/${id}` }, replace: true });
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      const username = await getCurrentUsername();
      await addDoc(collection(db, 'answers'), {
        content: answerContent,
        questionId: id,
        questionTitle: question?.title || 'Unknown Question',
        author: currentUser.displayName || username || 'Anonymous',
        userId: currentUser.uid,
        username: username || '',
        votes: 0,
        isAccepted: false,
        userVotes: {},
        createdAt: new Date()
      });
      
      // Update answer count in question
      const questionRef = doc(db, 'questions', id!);
      await updateDoc(questionRef, {
        answers: increment(1)
      });
      
      setAnswerContent('');
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (type: 'question' | 'answer', itemId: string, vote: 'up' | 'down') => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/question/${id}` }, replace: true });
      return;
    }
    
    try {
      const docRef = doc(db, type === 'question' ? 'questions' : 'answers', itemId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) return;
      
      const data = docSnap.data();
      const userVotes = data.userVotes || {};
      const currentVote = userVotes[currentUser.uid];
      
      let voteChange = 0;
      const newUserVotes = { ...userVotes };
      
      if (currentVote === vote) {
        // If clicking the same vote button again, remove the vote
        delete newUserVotes[currentUser.uid];
        voteChange = vote === 'up' ? -1 : 1;
      } else if (currentVote) {
        // If changing vote (e.g., from up to down)
        newUserVotes[currentUser.uid] = vote;
        voteChange = vote === 'up' ? 2 : -2;
      } else {
        // New vote
        newUserVotes[currentUser.uid] = vote;
        voteChange = vote === 'up' ? 1 : -1;
      }
      
      // Optimistic update for immediate UI feedback
      if (type === 'question' && question) {
        setQuestion(prev => prev ? {
          ...prev,
          votes: (prev.votes || 0) + voteChange,
          userVotes: newUserVotes
        } : null);
      } else if (type === 'answer') {
        setAnswers(prev => prev.map(answer => 
          answer.id === itemId ? {
            ...answer,
            votes: (answer.votes || 0) + voteChange,
            userVotes: newUserVotes
          } : answer
        ));
      }
      
      // Update Firestore
      await updateDoc(docRef, {
        votes: increment(voteChange),
        userVotes: newUserVotes
      });
      
    } catch (err) {
      console.error('Error voting:', err);
      setError('Failed to process vote');
      
      // Revert optimistic update on error by re-fetching the data
      try {
        if (type === 'question') {
          const questionRef = doc(db, 'questions', itemId);
          const questionSnap = await getDoc(questionRef);
          if (questionSnap.exists()) {
            setQuestion({
              id: questionSnap.id,
              ...questionSnap.data()
            } as Question);
          }
        } else {
          const answerRef = doc(db, 'answers', itemId);
          const answerSnap = await getDoc(answerRef);
          if (answerSnap.exists()) {
            setAnswers(prev => prev.map(answer => 
              answer.id === itemId ? {
                id: answerSnap.id,
                ...answerSnap.data()
              } as Answer : answer
            ));
          }
        }
      } catch (revertErr) {
        console.error('Error reverting optimistic update:', revertErr);
      }
    }
  };

  const handleAcceptAnswer = async (answerId: string) => {
    if (!currentUser || !question || question.authorId !== currentUser.uid) {
      return;
    }
    
    try {
      // First, unaccept any previously accepted answer
      const batch = writeBatch(db);
      const answersQuery = query(collection(db, 'answers'), where('questionId', '==', id));
      const answersSnap = await getDocs(answersQuery);
      
      answersSnap.docs.forEach(doc => {
        if (doc.data().isAccepted) {
          batch.update(doc.ref, { isAccepted: false });
        }
      });
      
      // Then accept the selected answer
      const answerRef = doc(db, 'answers', answerId);
      batch.update(answerRef, { isAccepted: true });
      
      await batch.commit();
      
    } catch {
      console.error('Error accepting answer');
      setError('Failed to accept answer');
    }
  };

  // Edit Question
  const handleEditQuestion = () => {
    setEditQuestionContent(question?.content || '');
    setEditQuestionMode(true);
  };
  const handleSaveQuestionEdit = async () => {
    if (!question || !currentUser || currentUser.uid !== question.authorId) return;
    try {
      await updateDoc(doc(db, 'questions', question.id), { content: editQuestionContent });
      setEditQuestionMode(false);
    } catch {
      setError('Failed to update question');
    }
  };
  // Delete Question
  const handleDeleteQuestion = async () => {
    if (!question || !currentUser || currentUser.uid !== question.authorId) return;
    try {
      await deleteDoc(doc(db, 'questions', question.id));
      // Optionally, delete all answers for this question
      const answersQuery = query(collection(db, 'answers'), where('questionId', '==', question.id));
      const answersSnap = await getDocs(answersQuery);
      for (const answerDoc of answersSnap.docs) {
        await deleteDoc(answerDoc.ref);
      }
      navigate('/');
    } catch {
      setError('Failed to delete question');
    }
  };
  // Edit Answer
  const handleEditAnswer = (answer: Answer) => {
    setEditAnswerId(answer.id);
    setEditAnswerContent(answer.content);
  };
  const handleSaveAnswerEdit = async (answerId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'answers', answerId), { content: editAnswerContent });
      setEditAnswerId(null);
    } catch {
      setError('Failed to update answer');
    }
  };
  // Delete Answer
  const handleDeleteAnswer = async (answerId: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'answers', answerId));
      // Decrement answer count on question
      if (question) {
        await updateDoc(doc(db, 'questions', question.id), { answers: increment(-1) });
      }
      setDeleteConfirm(null); // Close the confirmation dialog after deletion
    } catch {
      setError('Failed to delete answer');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || 'Question not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Question */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 whitespace-pre-wrap">
          <RenderTextWithLinks 
            text={question.title}
            availableUsers={availableUsers}
            onHashtagClick={handleHashtagClick}
            onMentionClick={handleMentionClick}
            preserveWhitespace={true}
          />
        </h1>
        
        <div className="flex items-start mb-4">
          <div className="flex flex-col items-center mr-4">
            <button 
              onClick={() => handleVote('question', question.id, 'up')}
              className={`p-1 rounded hover:bg-gray-100 ${question.userVotes?.[currentUser?.uid || ''] === 'up' ? 'text-blue-600' : 'text-gray-500'}`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            <span className="text-lg font-semibold my-1">
              {question.votes || 0}
            </span>
            
            <button 
              onClick={() => handleVote('question', question.id, 'down')}
              className={`p-1 rounded hover:bg-gray-100 ${question.userVotes?.[currentUser?.uid || ''] === 'down' ? 'text-red-600' : 'text-gray-500'}`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div className="flex-1">
            {editQuestionMode ? (
              <div className="mb-4">
                <MarkdownEditor
                  value={editQuestionContent}
                  onChange={setEditQuestionContent}
                  availableUsers={availableUsers}
                  onHashtagClick={handleHashtagClick}
                  onMentionClick={handleMentionClick}
                  placeholder="Edit your question... You can use **bold**, *italic*, `code`, [links](url), ![images](url), #hashtags, @mentions, and more!"
                  minHeight="150px"
                  maxHeight="400px"
                />
                <div className="flex gap-2 mt-2">
                  <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700" onClick={handleSaveQuestionEdit}>Save</button>
                  <button className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400" onClick={() => setEditQuestionMode(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="prose max-w-none mb-4 whitespace-pre-wrap">
                  <RenderTextWithLinks 
                    text={question.content}
                    availableUsers={availableUsers}
                    onHashtagClick={handleHashtagClick}
                    onMentionClick={handleMentionClick}
                    preserveWhitespace={true}
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {question.tags?.map((tag, index) => (
                    <Link 
                      key={index} 
                      to={`/search?q=${encodeURIComponent(tag)}&type=questions&searchBy=tags`}
                      className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                      title={`Search all questions tagged with "${tag}"`}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
                
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div className="flex items-center">
                    <span>Asked {formatDistanceToNow(new Date(question.createdAt.seconds * 1000))} ago</span>
                  </div>
                  
                  <div className="bg-blue-50 px-3 py-1 rounded flex items-center">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(question.author)}`} 
                      alt={question.author}
                      className="w-6 h-6 rounded-full mr-2"
                    />
                    <Link to={`/@${question.username}`} className="text-blue-600 hover:underline">
                      @{question.username || 'unknown'}
                    </Link>
                  </div>
                </div>
                
                {currentUser?.uid === question.authorId && (
                  <div className="flex gap-2 mt-4">
                    <button 
                      onClick={handleEditQuestion}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit question"
                    >
                      <FiEdit className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm({ type: 'question', id: question.id })}
                      className="text-red-600 hover:text-red-700"
                      title="Delete question"
                    >
                      <FiTrash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Question Confirmation */}
      {deleteConfirm?.type === 'question' && deleteConfirm.id === question.id && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <p className="mb-4">Are you sure you want to delete this question? This cannot be undone.</p>
            <div className="flex gap-2">
              <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={handleDeleteQuestion}>Delete</button>
              <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Answers */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}</h2>
        
        {answers.length === 0 ? (
          <p className="text-gray-500 italic">No answers yet. Be the first to answer!</p>
        ) : (
          <div className="space-y-6">
            {answers.map(answer => (
              <div key={answer.id} className={`border rounded-lg p-4 ${answer.isAccepted ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-start">
                  <div className="flex flex-col items-center mr-4">
                    <button 
                      onClick={() => handleVote('answer', answer.id, 'up')}
                      className={`p-1 rounded hover:bg-gray-100 ${answer.userVotes?.[currentUser?.uid || ''] === 'up' ? 'text-blue-600' : 'text-gray-500'}`}
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    <span className="text-lg font-semibold my-1">
                      {answer.votes || 0}
                    </span>
                    
                    <button 
                      onClick={() => handleVote('answer', answer.id, 'down')}
                      className={`p-1 rounded hover:bg-gray-100 ${answer.userVotes?.[currentUser?.uid || ''] === 'down' ? 'text-red-600' : 'text-gray-500'}`}
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {currentUser?.uid === question.authorId && (
                      <button 
                        onClick={() => handleAcceptAnswer(answer.id)}
                        className={`mt-2 p-1 rounded ${answer.isAccepted ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={answer.isAccepted ? 'Accepted answer' : 'Mark as accepted answer'}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    {answer.isAccepted && (
                      <div className="text-green-600 text-sm font-medium mb-2 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Accepted Answer
                      </div>
                    )}
                    
                    {editAnswerId === answer.id ? (
                      <div className="mb-4">
                        <MarkdownEditor
                          value={editAnswerContent}
                          onChange={setEditAnswerContent}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                          placeholder="Edit your answer... You can use **bold**, *italic*, `code`, [links](url), ![images](url), #hashtags, @mentions, and more!"
                          minHeight="150px"
                          maxHeight="400px"
                        />
                        <div className="flex gap-2 mt-2">
                          <button className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700" onClick={() => handleSaveAnswerEdit(answer.id)}>Save</button>
                          <button className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400" onClick={() => setEditAnswerId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="prose max-w-none mb-4 whitespace-pre-wrap">
                          <RenderTextWithLinks 
                            text={answer.content}
                            availableUsers={availableUsers}
                            onHashtagClick={handleHashtagClick}
                            onMentionClick={handleMentionClick}
                            preserveWhitespace={true}
                          />
                        </div>
                        
                        <div className="flex justify-between items-center text-sm text-gray-500">
                          <div className="flex items-center">
                            <span>Answered {formatDistanceToNow(new Date(answer.createdAt.seconds * 1000))} ago</span>
                          </div>
                          
                          <div className="bg-blue-50 px-3 py-1 rounded flex items-center">
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(answer.author)}`} 
                              alt={answer.author}
                              className="w-6 h-6 rounded-full mr-2"
                            />
                            <Link to={`/@${answer.username}`} className="text-blue-600 hover:underline">
                              @{answer.username || 'unknown'}
                            </Link>
                          </div>
                        </div>
                        
                        {currentUser?.uid === answer.userId && (
                          <div className="flex gap-2 mt-4">
                            <button 
                              onClick={() => handleEditAnswer(answer)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Edit answer"
                            >
                              <FiEdit className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm({ type: 'answer', id: answer.id })}
                              className="text-red-600 hover:text-red-700"
                              title="Delete answer"
                            >
                              <FiTrash2 className="h-5 w-5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Answer Form */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Answer</h2>
        
        {!currentUser ? (
          <div className="text-center py-4">
            <p className="mb-4">Please <Link to="/login" className="text-blue-600 hover:underline">login</Link> to post an answer.</p>
          </div>
        ) : (
          <form onSubmit={handleAnswerSubmit}>
            <div className="mb-4">
              <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                Answer
              </label>
              <MarkdownEditor
                value={answerContent}
                onChange={setAnswerContent}
                availableUsers={availableUsers}
                onHashtagClick={handleHashtagClick}
                onMentionClick={handleMentionClick}
                placeholder="Write your answer here... You can use **bold**, *italic*, `code`, [links](url), ![images](url), #hashtags, @mentions, and more!"
                minHeight="200px"
                maxHeight="500px"
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting...' : 'Post Your Answer'}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Delete Answer Confirmation */}
      {deleteConfirm?.type === 'answer' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white p-6 rounded shadow-lg">
            <p className="mb-4">Are you sure you want to delete this answer? This cannot be undone.</p>
            <div className="flex gap-2">
              <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={() => handleDeleteAnswer(deleteConfirm.id)}>Delete</button>
              <button className="bg-gray-300 px-4 py-2 rounded" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionDetail;
