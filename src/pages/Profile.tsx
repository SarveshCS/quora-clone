import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateProfile } from 'firebase/auth';
import LoadingSpinner from '../components/LoadingSpinner';
import { RenderTextWithLinks } from '../utils/textRendering';
import { createHashtagClickHandler, createMentionClickHandler, type User } from '../utils/textUtils';

interface Question {
  id: string;
  title: string;
  createdAt: { seconds: number };
  votes: number;
  answers: number;
  username: string; // <-- add this for username
}

interface Answer {
  id: string;
  content: string;
  questionId: string;
  questionTitle: string;
  votes: number;
  createdAt: { seconds: number };
}

const Profile = () => {
  const { currentUser } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('questions');
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        // Fetch user's questions (without orderBy to avoid index requirements)
        const questionsQuery = query(
          collection(db, 'questions'),
          where('authorId', '==', currentUser.uid)
        );
        
        const questionsSnapshot = await getDocs(questionsQuery);
        const questionsData = questionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          username: doc.data().username || '',
        })) as Question[];
        
        // Sort client-side to avoid Firestore index requirements
        const sortedQuestions = questionsData.sort((a, b) => 
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setQuestions(sortedQuestions);
        
        // Fetch user's answers with question titles (without orderBy to avoid index requirements)
        const answersQuery = query(
          collection(db, 'answers'),
          where('userId', '==', currentUser.uid)
        );
        
        const answersSnapshot = await getDocs(answersQuery);
        
        // Optimize: Batch fetch question titles instead of individual calls
        const answerDocs = answersSnapshot.docs;
        const questionIds = [...new Set(answerDocs.map(doc => doc.data().questionId))];
        
        // Fetch all questions at once if we have question IDs
        const questionTitles: Record<string, string> = {};
        if (questionIds.length > 0) {
          // Batch fetch questions - limit to 10 at a time to avoid Firestore limits
          const batchSize = 10;
          for (let i = 0; i < questionIds.length; i += batchSize) {
            const batch = questionIds.slice(i, i + batchSize);
            const questionsQuery = query(
              collection(db, 'questions'),
              where('__name__', 'in', batch)
            );
            const questionsSnapshot = await getDocs(questionsQuery);
            questionsSnapshot.docs.forEach(doc => {
              questionTitles[doc.id] = doc.data().title;
            });
          }
        }
        
        // Map answers with question titles and sort client-side
        const answersData = answerDocs.map(answerDoc => {
          const answerData = answerDoc.data() as Omit<Answer, 'id' | 'questionTitle'>;
          return {
            id: answerDoc.id,
            ...answerData,
            questionTitle: questionTitles[answerData.questionId] || 'Question not found'
          } as Answer;
        });
        
        // Sort client-side to avoid Firestore index requirements
        const sortedAnswers = answersData.sort((a, b) => 
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        
        setAnswers(sortedAnswers);
      } catch (error: unknown) {
        console.error('Error fetching user data:', error);
        let errorMessage = 'Failed to load profile data';
        
        if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === 'permission-denied') {
            errorMessage = 'You don\'t have permission to access this data. Please check your Firestore security rules.';
          } else if (error.code === 'unavailable') {
            errorMessage = 'Database is temporarily unavailable. Please try again later.';
          }
        } else if (error instanceof Error) {
          errorMessage = `Error: ${error.message}`;
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      // Fetch username from Firestore
      const fetchUsername = async () => {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username || '');
        }
      };
      fetchUsername();
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchUsernamesForQuestions = async () => {
      // Only fetch if there are questions and any are missing username
      const missing = questions.filter(q => !q.username && q.id);
      if (missing.length === 0) return;
      const updates: { [id: string]: string } = {};
      for (const q of missing) {
        try {
          // Use authorId if available, else fallback to currentUser?.uid
          const uid = (q as { authorId?: string }).authorId || (currentUser ? currentUser.uid : '');
          if (!uid) continue;
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            updates[q.id] = userDoc.data().username || '';
          }
        } catch {
          // Ignore errors for missing users
        }
      }
      if (Object.keys(updates).length > 0) {
        setQuestions(prev => prev.map(q => updates[q.id] ? { ...q, username: updates[q.id] } : q));
      }
    };
    fetchUsernamesForQuestions();
  }, [questions, currentUser]);

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

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 sm:px-4 py-3 rounded relative text-sm sm:text-base" role="alert">
          <span className="block sm:inline">Please log in to view your profile.</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-3 rounded relative text-sm sm:text-base" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4">
      <div className="bg-white shadow overflow-hidden rounded-lg sm:rounded-lg mb-6 sm:mb-8">
        <div className="px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mx-auto sm:mx-0 mb-4 sm:mb-0">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt={displayName || 'User'} 
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-lg sm:text-2xl text-gray-500">
                  {displayName?.charAt(0).toUpperCase() || username?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="sm:ml-6 text-center sm:text-left">
              {editMode ? (
                <form onSubmit={handleProfileUpdate} className="space-y-3 sm:space-y-2">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      disabled={profileLoading}
                      maxLength={30}
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-sm"
                      disabled={profileLoading}
                      maxLength={20}
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique, 3-20 characters, letters, numbers, or underscores. Used in URLs.</p>
                  </div>
                  {profileError && <div className="text-red-600 text-xs sm:text-sm">{profileError}</div>}
                  {profileSuccess && <div className="text-green-600 text-xs sm:text-sm">{profileSuccess}</div>}
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm" disabled={profileLoading}>Save</button>
                    <button type="button" className="bg-gray-300 text-gray-700 px-4 py-2 rounded text-sm" onClick={() => setEditMode(false)} disabled={profileLoading}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{displayName || 'Anonymous User'}</h1>
                  <p className="text-gray-600 text-sm sm:text-base">@{username}</p>
                  <p className="mt-2 text-xs sm:text-sm text-gray-500">Member since {new Date(currentUser.metadata.creationTime || '').toLocaleDateString()}</p>
                  <button className="mt-3 sm:mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm" onClick={() => setEditMode(true)}>Edit Profile</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('questions')}
            className={`${activeTab === 'questions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex-shrink-0`}
          >
            Questions ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('answers')}
            className={`${activeTab === 'answers' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm flex-shrink-0`}
          >
            Answers ({answers.length})
          </button>
        </nav>
      </div>

      {activeTab === 'questions' ? (
        <div className="space-y-3 sm:space-y-4">
          {questions.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <h3 className="mt-2 text-lg font-medium text-gray-900">No questions yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't asked any questions yet. 
                <a href="/ask" className="text-blue-600 hover:text-blue-800 ml-1">Ask your first question</a> to get started!
              </p>
            </div>
          ) : (
            questions.map((question) => (
              <div key={question.id} className="bg-white shadow overflow-hidden rounded-lg sm:rounded-lg">
                <div className="px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <a 
                        href={`/question/${question.id}`}
                        className="text-base sm:text-lg font-medium text-blue-600 hover:text-blue-800 block whitespace-pre-wrap break-words"
                      >
                        <RenderTextWithLinks
                          text={question.title}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </a>
                      <div className="mt-2 flex flex-wrap items-center text-xs sm:text-sm text-gray-500 gap-1 sm:gap-2">
                        <span>{question.answers} answers</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{question.votes} votes</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Asked on {formatDate(question.createdAt)}</span>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex flex-col sm:flex-row sm:items-center">
                      <span className="text-xs sm:text-sm text-gray-500">by</span>
                      <Link 
                        to={`/@${question.username}`}
                        className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 sm:ml-1"
                      >
                        {question.username || 'unknown'}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {answers.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <h3 className="mt-2 text-lg font-medium text-gray-900">No answers yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                You haven't answered any questions yet. 
                <a href="/" className="text-blue-600 hover:text-blue-800 ml-1">Browse questions</a> to start answering!
              </p>
            </div>
          ) : (
            answers.map((answer) => (
              <div key={answer.id} className="bg-white shadow overflow-hidden rounded-lg sm:rounded-lg">
                <div className="px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs sm:text-sm font-medium text-gray-500">
                        Answered on {formatDate(answer.createdAt)}
                      </h3>
                      <a 
                        href={`/question/${answer.questionId}`}
                        className="text-base sm:text-lg font-medium text-blue-600 hover:text-blue-800 mt-1 block break-words"
                      >
                        {answer.questionTitle}
                      </a>
                      <div className="mt-2 text-gray-600 line-clamp-2 whitespace-pre-wrap text-sm break-words">
                        <RenderTextWithLinks
                          text={answer.content}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </div>
                      <div className="mt-2 flex items-center text-xs sm:text-sm text-gray-500">
                        <span>{answer.votes} votes</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
