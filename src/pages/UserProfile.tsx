import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '../firebase/config';
import LoadingSpinner from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiEdit, FiTrash2 } from 'react-icons/fi';
import { RenderTextWithLinks } from '../utils/textRendering';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

interface UserProfileData {
  uid: string;
  username: string;
  displayName: string;
  createdAt?: { seconds: number } | Date; // For user creation time
}

interface Question {
  id: string;
  title: string;
  createdAt: { seconds: number };
  votes: number;
  answers: number;
}

interface Answer {
  id: string;
  content: string;
  questionId: string;
  questionTitle: string;
  votes: number;
  createdAt: { seconds: number };
}

const UserProfile = () => {
  const { username: usernameParam } = useParams<{ username?: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('questions');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'question' | 'answer' | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  
  // Edit mode states (only used when isOwner is true)
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

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

  // Extract username from either route pattern
  const getUsernameFromRoute = () => {
    if (usernameParam) {
      // Handle /@username pattern - remove @ prefix if present
      return usernameParam.startsWith('@') ? usernameParam.slice(1) : usernameParam;
    }
    return null;
  };

  const usernameToFetch = getUsernameFromRoute();

  // Don't fetch if this looks like a system route that shouldn't be a username
  const systemRoutes = ['login', 'register', 'ask', 'simple', 'question', 'profile'];
  const shouldFetch = usernameToFetch && !systemRoutes.includes(usernameToFetch);

  useEffect(() => {
    const fetchUserProfile = async () => {
      setLoading(true);
      setError('');
      try {
        // Find user by username
        const q = query(collection(db, 'users'), where('username', '==', usernameToFetch));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError('User not found');
          setLoading(false);
          return;
        }
        const userDoc = snap.docs[0];
        const userData = userDoc.data() as UserProfileData;
        setUser(userData);

        // Fetch user's questions
        const questionsQ = query(collection(db, 'questions'), where('authorId', '==', userData.uid));
        const questionsSnap = await getDocs(questionsQ);
        const questionsData = questionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Question[];
        questionsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setQuestions(questionsData);

        // Fetch user's answers
        const answersQ = query(collection(db, 'answers'), where('userId', '==', userData.uid));
        const answersSnap = await getDocs(answersQ);
        const answersData = answersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Answer[];
        
        // For answers that don't have questionTitle, fetch it from the questions collection
        const answersNeedingTitles = answersData.filter(answer => !answer.questionTitle && answer.questionId);
        if (answersNeedingTitles.length > 0) {
          const questionTitles: Record<string, string> = {};
          for (const answer of answersNeedingTitles) {
            try {
              const questionDoc = await getDoc(doc(db, 'questions', answer.questionId));
              if (questionDoc.exists()) {
                questionTitles[answer.questionId] = questionDoc.data().title || 'Question not found';
              }
            } catch (error) {
              console.error('Error fetching question title:', error);
              questionTitles[answer.questionId] = 'Question not found';
            }
          }
          
          // Update answers with fetched question titles
          answersData.forEach(answer => {
            if (!answer.questionTitle && questionTitles[answer.questionId]) {
              answer.questionTitle = questionTitles[answer.questionId];
            }
          });
        }
        
        answersData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setAnswers(answersData);
      } catch {
        setError('Failed to load user profile');
      } finally {
        setLoading(false);
      }
    };
    if (shouldFetch) fetchUserProfile();
  }, [usernameToFetch, shouldFetch]);

  // Initialize edit form data when user data is loaded and it's the owner
  useEffect(() => {
    if (user && currentUser && user.uid === currentUser.uid) {
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
    }
  }, [user, currentUser]);

  // Redirect to home if this is a system route
  if (usernameToFetch && systemRoutes.includes(usernameToFetch)) {
    return <Navigate to="/" replace />;
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);
    try {
      if (!displayName.trim()) throw new Error('Display name cannot be empty');
      if (!/^([a-zA-Z0-9_]{3,20})$/.test(username)) throw new Error('Username must be 3-20 characters, letters, numbers, or underscores');
      if (!currentUser) throw new Error('User not authenticated');
      
      // Check username uniqueness
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snap = await getDocs(q);
      if (!snap.empty && snap.docs[0].id !== currentUser.uid) {
        throw new Error('Username is already taken');
      }
      
      // Update Firestore user profile
      await setDoc(doc(db, 'users', currentUser.uid), {
        username,
        displayName,
        email: currentUser.email,
        updatedAt: new Date(),
        uid: currentUser.uid
      }, { merge: true });
      
      // Update Auth profile
      await updateProfile(currentUser, { displayName });
      
      // Update local user state
      setUser(prev => prev ? { ...prev, displayName, username } : null);
      
      setProfileSuccess('Profile updated successfully!');
      setEditMode(false);
    } catch (err: unknown) {
      let msg = 'Failed to update profile';
      if (err instanceof Error) msg = err.message;
      setProfileError(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  const formatDate = (timestamp: { seconds: number }) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  // Handle delete confirmation
  const handleDeleteClick = (id: string, type: 'question' | 'answer') => {
    setDeleteConfirmId(id);
    setDeleteType(type);
  };

  // Handle delete action
  const handleDelete = async () => {
    if (!deleteConfirmId || !deleteType) return;

    try {
      if (deleteType === 'question') {
        await deleteDoc(doc(db, 'questions', deleteConfirmId));
        setQuestions(prev => prev.filter(q => q.id !== deleteConfirmId));
      } else {
        await deleteDoc(doc(db, 'answers', deleteConfirmId));
        setAnswers(prev => prev.filter(a => a.id !== deleteConfirmId));
      }
      setDeleteConfirmId(null);
      setDeleteType(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  // Handle edit navigation
  const handleEditClick = (id: string, type: 'question' | 'answer') => {
    if (type === 'question') {
      navigate(`/question/${id}?autoEdit=true&autoEditType=question&autoEditId=${id}`);
    } else {
      // For answers, find the question and navigate with answer ID
      const answer = answers.find(a => a.id === id);
      if (answer) {
        navigate(`/question/${answer.questionId}?autoEdit=true&autoEditType=answer&autoEditId=${id}#answer-${id}`);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><LoadingSpinner message="Loading profile..." /></div>;
  }
  if (error) {
    return <div className="max-w-4xl mx-auto p-4"><div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">{error}</div></div>;
  }
  if (!user) return null;

  // Check if this is the logged-in user's own profile
  const isOwner = currentUser && user && currentUser.uid === user.uid;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center">
            <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {currentUser?.photoURL && isOwner ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl text-gray-500">
                  {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="ml-6">
              {editMode && isOwner ? (
                <form onSubmit={handleProfileUpdate} className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      disabled={profileLoading}
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                      disabled={profileLoading}
                      maxLength={20}
                    />
                    <p className="text-xs text-gray-500">Unique, 3-20 characters, letters, numbers, or underscores. Used in URLs.</p>
                  </div>
                  {profileError && <div className="text-red-600 text-sm">{profileError}</div>}
                  {profileSuccess && <div className="text-green-600 text-sm">{profileSuccess}</div>}
                  <div className="flex space-x-2">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={profileLoading}>Save</button>
                    <button type="button" className="bg-gray-300 text-gray-700 px-4 py-2 rounded" onClick={() => setEditMode(false)} disabled={profileLoading}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{user.displayName || 'Anonymous User'}</h1>
                  <p className="text-gray-600">@{user.username}</p>
                  {isOwner && currentUser && (
                    <>
                      <p className="mt-2 text-sm text-gray-500">
                        Member since {user.createdAt ? 
                          (user.createdAt && typeof user.createdAt === 'object' && 'seconds' in user.createdAt ? 
                            new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 
                            new Date(user.createdAt as Date).toLocaleDateString()
                          ) : 
                          (currentUser.metadata.creationTime ? 
                            new Date(currentUser.metadata.creationTime).toLocaleDateString() : 
                            'Date not available'
                          )
                        }
                      </p>
                      <button className="mt-2 bg-blue-600 text-white px-4 py-2 rounded" onClick={() => setEditMode(true)}>Edit Profile</button>
                    </>
                  )}
                  {!isOwner && (
                    <p className="mt-2 text-sm text-gray-500">
                      Member since {user.createdAt ? 
                        (user.createdAt && typeof user.createdAt === 'object' && 'seconds' in user.createdAt ? 
                          new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 
                          new Date(user.createdAt as Date).toLocaleDateString()
                        ) : 
                        'Date not available'
                      }
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('questions')}
            className={`${activeTab === 'questions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Questions ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('answers')}
            className={`${activeTab === 'answers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Answers ({answers.length})
          </button>
        </nav>
      </div>

      {activeTab === 'questions' ? (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-lg font-medium text-gray-900">No questions yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isOwner ? (
                  <>
                    You haven't asked any questions yet. 
                    <Link to="/ask" className="text-blue-600 hover:text-blue-800 ml-1">Ask your first question</Link> to get started!
                  </>
                ) : (
                  `@${user.username} hasn't asked any questions yet.`
                )}
              </p>
            </div>
          ) : (
            questions.map((question) => (
              <div key={question.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/question/${question.id}`}
                        className="text-lg font-medium text-blue-600 hover:text-blue-800 truncate block whitespace-pre-wrap"
                      >
                        <RenderTextWithLinks
                          text={question.title}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </Link>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span>{question.answers || 0} answers</span>
                        <span className="mx-2">•</span>
                        <span>{question.votes || 0} votes</span>
                        <span className="mx-2">•</span>
                        <span>Asked on {formatDate(question.createdAt)}</span>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="ml-4 flex-shrink-0">
                        <button 
                          onClick={() => handleEditClick(question.id, 'question')}
                          className="text-gray-400 hover:text-gray-500"
                          title="Edit question"
                        >
                          <FiEdit className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(question.id, 'question')}
                          className="text-red-600 hover:text-red-700 ml-2"
                          title="Delete question"
                        >
                          <FiTrash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {answers.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="mt-2 text-lg font-medium text-gray-900">No answers yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isOwner ? (
                  <>
                    You haven't answered any questions yet. 
                    <Link to="/" className="text-blue-600 hover:text-blue-800 ml-1">Browse questions</Link> to start answering!
                  </>
                ) : (
                  `@${user.username} hasn't answered any questions yet.`
                )}
              </p>
            </div>
          ) : (
            answers.map((answer) => (
              <div key={answer.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-500">
                        Answered on {formatDate(answer.createdAt)}
                      </h3>
                      <Link 
                        to={`/question/${answer.questionId}`}
                        className="text-lg font-medium text-blue-600 hover:text-blue-800 mt-1 block"
                      >
                        {answer.questionTitle || 'Question (Title not available)'}
                      </Link>
                      <div className="mt-2 text-gray-600 line-clamp-2 whitespace-pre-wrap">
                        <RenderTextWithLinks
                          text={answer.content}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span>{answer.votes || 0} votes</span>
                      </div>
                    </div>
                    {isOwner && (
                      <div className="ml-4 flex-shrink-0">
                        <button 
                          onClick={() => handleEditClick(answer.id, 'answer')}
                          className="text-gray-400 hover:text-gray-500"
                          title="Edit answer"
                        >
                          <FiEdit className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button 
                          onClick={() => handleDeleteClick(answer.id, 'answer')}
                          className="text-red-600 hover:text-red-700 ml-2"
                          title="Delete answer"
                        >
                          <FiTrash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete confirmation modal (simplified) */}
      {deleteConfirmId && deleteType && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {deleteType === 'question' ? 'Delete Question' : 'Delete Answer'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete this {deleteType === 'question' ? 'question' : 'answer'}?
            </p>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;
