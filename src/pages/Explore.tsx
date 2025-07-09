import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit, startAfter, DocumentSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiSearch } from 'react-icons/fi';
import { RenderTextWithLinks } from '../utils/textRendering';
import { createHashtagClickHandler, createMentionClickHandler, type User as UtilUser } from '../utils/textUtils';

interface Question {
  id: string;
  title: string;
  content: string;
  username?: string;
  authorId: string;
  createdAt: { seconds: number };
  votes: number;
  answers: number;
  tags?: string[];
  views?: number;
  trendingScore?: number;
}

interface User {
  uid: string;
  username: string;
  displayName: string;
  questionsAnswered?: number;
  questionsAsked?: number;
  totalVotes?: number;
  contributorScore?: number;
}

interface Answer {
  id: string;
  authorId?: string; // Legacy field
  userId?: string; // Current field
  votes: number;
  content: string;
  createdAt: { seconds: number };
}

const QUESTIONS_PER_PAGE = 10;

const Explore = () => {
  const [trendingQuestions, setTrendingQuestions] = useState<Question[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);
  const [topUsers, setTopUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('trending');
  const [hasMoreTrending, setHasMoreTrending] = useState(true);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [lastTrendingDoc, setLastTrendingDoc] = useState<DocumentSnapshot | null>(null);
  const [lastRecentDoc, setLastRecentDoc] = useState<DocumentSnapshot | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<UtilUser[]>([]);
  const navigate = useNavigate();
  const trendingLoadMoreRef = useRef<HTMLDivElement>(null);
  const recentLoadMoreRef = useRef<HTMLDivElement>(null);

  // Create handlers for hashtag and mention clicks
  const handleHashtagClick = createHashtagClickHandler(navigate);
  const handleMentionClick = createMentionClickHandler(navigate);

  // Fetch available users for mention validation
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, 'users'));
        const usersSnap = await getDocs(usersQuery);
        const users: UtilUser[] = usersSnap.docs.map(doc => ({
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

  // Function to calculate trending score
  const calculateTrendingScore = (question: Question): number => {
    const now = new Date();
    const createdAt = new Date(question.createdAt.seconds * 1000);
    const daysAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // If question is older than 10 days, give it very low score
    if (daysAgo > 10) {
      return (question.votes || 0) * 0.1;
    }
    
    // Calculate score based on votes and recency
    const baseScore = question.votes || 0;
    const recencyMultiplier = Math.max(0.1, 1 - (daysAgo / 10)); // Decreases from 1 to 0.1 over 10 days
    const engagementBonus = (question.answers || 0) * 0.2; // Small bonus for engagement
    
    return baseScore * recencyMultiplier + engagementBonus;
  };

  // Function to load more trending questions
  const loadMoreTrending = useCallback(async () => {
    if (loadingMore || !hasMoreTrending) return;
    
    setLoadingMore(true);
    try {
      // Fetch more questions and calculate trending scores
      const q = query(
        collection(db, 'questions'),
        orderBy('createdAt', 'desc'), // Get recent questions first
        startAfter(lastTrendingDoc),
        limit(QUESTIONS_PER_PAGE * 2) // Get more to filter by trending score
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setHasMoreTrending(false);
      } else {
        const newQuestions = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Question[];
        
        // Fetch missing usernames
        const questionsToFetchUsername = newQuestions.filter(q => !q.username && q.authorId);
        const userMap: Record<string, string> = {};
        
        if (questionsToFetchUsername.length > 0) {
          const userDocs = await Promise.all(
            questionsToFetchUsername.map(q => getDoc(doc(db, 'users', q.authorId)))
          );
          userDocs.forEach((userDoc, idx) => {
            if (userDoc.exists()) {
              userMap[questionsToFetchUsername[idx].authorId] = userDoc.data().username || '';
            }
          });
        }
        
        // Enhance questions with usernames and trending scores
        const enhancedQuestions = newQuestions
          .map(question => ({
            ...question,
            username: question.username || userMap[question.authorId] || 'unknown',
            trendingScore: calculateTrendingScore(question),
          }))
          .filter(q => q.trendingScore > 0.1) // Lower threshold for better results
          .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
          .slice(0, QUESTIONS_PER_PAGE);
        
        setTrendingQuestions(prev => [...prev, ...enhancedQuestions]);
        setLastTrendingDoc(snap.docs[snap.docs.length - 1]);
        setHasMoreTrending(snap.docs.length === QUESTIONS_PER_PAGE * 2 && enhancedQuestions.length > 0); // Better hasMore logic
      }
    } catch (error) {
      console.error('Error loading more trending questions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreTrending, lastTrendingDoc]);

  // Function to load more recent questions
  const loadMoreRecent = useCallback(async () => {
    if (loadingMore || !hasMoreRecent) return;
    
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'questions'),
        orderBy('createdAt', 'desc'),
        startAfter(lastRecentDoc),
        limit(QUESTIONS_PER_PAGE)
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setHasMoreRecent(false);
      } else {
        const newQuestions = snap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Question[];
        
        // Fetch missing usernames
        const questionsToFetchUsername = newQuestions.filter(q => !q.username && q.authorId);
        const userMap: Record<string, string> = {};
        
        if (questionsToFetchUsername.length > 0) {
          const userDocs = await Promise.all(
            questionsToFetchUsername.map(q => getDoc(doc(db, 'users', q.authorId)))
          );
          userDocs.forEach((userDoc, idx) => {
            if (userDoc.exists()) {
              userMap[questionsToFetchUsername[idx].authorId] = userDoc.data().username || '';
            }
          });
        }
        
        // Enhance questions with usernames
        const enhancedQuestions = newQuestions.map(question => ({
          ...question,
          username: question.username || userMap[question.authorId] || 'unknown',
        }));
        
        setRecentQuestions(prev => [...prev, ...enhancedQuestions]);
        setLastRecentDoc(snap.docs[snap.docs.length - 1]);
      }
    } catch (error) {
      console.error('Error loading more recent questions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreRecent, lastRecentDoc]);

  // Handle search submission
  const handleSearch = () => {
    if (searchTerm.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}&type=questions`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    const fetchExploreData = async () => {
      setLoading(true);
      try {
        // Fetch recent questions for trending calculation (last 10 days)
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        
        const questionsQuery = query(
          collection(db, 'questions'),
          orderBy('createdAt', 'desc'),
          limit(100) // Get more questions to calculate trending properly
        );
        const questionsSnap = await getDocs(questionsQuery);
        const allQuestionsRaw = questionsSnap.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Question[];
        
        // Fetch missing usernames for all questions
        const questionsToFetchUsername = allQuestionsRaw.filter(q => !q.username && q.authorId);
        const userMap: Record<string, string> = {};
        
        if (questionsToFetchUsername.length > 0) {
          const userDocs = await Promise.all(
            questionsToFetchUsername.map(q => getDoc(doc(db, 'users', q.authorId)))
          );
          userDocs.forEach((userDoc, idx) => {
            if (userDoc.exists()) {
              userMap[questionsToFetchUsername[idx].authorId] = userDoc.data().username || '';
            }
          });
        }
        
        const allQuestionsEnhanced = allQuestionsRaw.map(question => ({
          ...question,
          username: question.username || userMap[question.authorId] || 'unknown',
          trendingScore: calculateTrendingScore(question),
        }));
        
        // Filter and sort trending questions
        const trendingData = allQuestionsEnhanced
          .filter(q => q.trendingScore > 0.1) // Lower threshold for better results
          .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0))
          .slice(0, QUESTIONS_PER_PAGE);
        
        setTrendingQuestions(trendingData);
        if (questionsSnap.docs.length > 0) {
          setLastTrendingDoc(questionsSnap.docs[questionsSnap.docs.length - 1]);
        }
        setHasMoreTrending(questionsSnap.docs.length >= QUESTIONS_PER_PAGE && trendingData.length > 0); // Better logic

        // Set recent questions (first 10 from the enhanced list)
        const recentData = allQuestionsEnhanced.slice(0, QUESTIONS_PER_PAGE);
        setRecentQuestions(recentData);
        if (questionsSnap.docs.length > 0) {
          setLastRecentDoc(questionsSnap.docs[questionsSnap.docs.length - 1]);
        }
        setHasMoreRecent(allQuestionsEnhanced.length === QUESTIONS_PER_PAGE);

        // Fetch all answers to calculate contributor scores
        const answersSnap = await getDocs(collection(db, 'answers'));
        const answersData = answersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Answer[];

        // Calculate contributor statistics
        const contributorStats: Record<string, { questionsAnswered: number; totalVotes: number; userId: string }> = {};
        
        answersData.forEach(answer => {
          // Use userId for answers, not authorId (handle both for backward compatibility)
          const userId = answer.userId || answer.authorId;
          if (userId) {
            if (!contributorStats[userId]) {
              contributorStats[userId] = {
                questionsAnswered: 0,
                totalVotes: 0,
                userId: userId
              };
            }
            contributorStats[userId].questionsAnswered++;
            contributorStats[userId].totalVotes += answer.votes || 0;
          }
        });

        console.log('Contributor stats:', contributorStats);

        // Fetch all users and enhance with contributor data
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData = usersSnap.docs.map(docSnap => ({
          uid: docSnap.id,
          ...docSnap.data(),
        })) as User[];

        // If no answers exist, show users who asked questions as contributors
        if (answersData.length === 0) {
          console.log('No answers found, using question-based contributors');
          
          // Get question authors as fallback contributors using the enhanced questions we just calculated
          const questionAuthorStats: Record<string, { questionsAsked: number; totalQuestionVotes: number }> = {};
          
          allQuestionsEnhanced.forEach(question => {
            if (question.authorId) {
              if (!questionAuthorStats[question.authorId]) {
                questionAuthorStats[question.authorId] = {
                  questionsAsked: 0,
                  totalQuestionVotes: 0
                };
              }
              questionAuthorStats[question.authorId].questionsAsked++;
              questionAuthorStats[question.authorId].totalQuestionVotes += question.votes || 0;
            }
          });

          console.log('Question author stats:', questionAuthorStats);

          const questionBasedContributors = usersData
            .map(user => {
              const stats = questionAuthorStats[user.uid] || { questionsAsked: 0, totalQuestionVotes: 0 };
              const contributorScore = (stats.questionsAsked * 1) + (stats.totalQuestionVotes * 0.3); // Lower weight for questions vs answers
              
              return {
                ...user,
                questionsAnswered: 0,
                questionsAsked: stats.questionsAsked,
                totalVotes: stats.totalQuestionVotes,
                contributorScore,
              };
            })
            .filter(user => user.contributorScore > 0) // Only users who have asked questions
            .sort((a, b) => (b.contributorScore || 0) - (a.contributorScore || 0))
            .slice(0, 12);

          console.log('Question-based contributors:', questionBasedContributors);
          setTopUsers(questionBasedContributors);
        } else {
          console.log('Using answer-based contributors');
          // Calculate contributor scores and sort (original logic)
          const topContributors = usersData
            .map(user => {
              const stats = contributorStats[user.uid] || { questionsAnswered: 0, totalVotes: 0, userId: user.uid };
              const contributorScore = (stats.questionsAnswered * 2) + (stats.totalVotes * 0.5); // Weight answers more than votes
              
              return {
                ...user,
                questionsAnswered: stats.questionsAnswered,
                totalVotes: stats.totalVotes,
                contributorScore,
              };
            })
            .filter(user => user.contributorScore > 0) // Only users who have contributed
            .sort((a, b) => (b.contributorScore || 0) - (a.contributorScore || 0))
            .slice(0, 12); // Show top 12 contributors

          console.log('Answer-based contributors:', topContributors);
          
          // If no contributors found with answers, try to include all users who have asked questions
          if (topContributors.length === 0) {
            console.log('No answer-based contributors found, falling back to question-based');
            
            const questionAuthorStats: Record<string, { questionsAsked: number; totalQuestionVotes: number }> = {};
            
            allQuestionsEnhanced.forEach(question => {
              if (question.authorId) {
                if (!questionAuthorStats[question.authorId]) {
                  questionAuthorStats[question.authorId] = {
                    questionsAsked: 0,
                    totalQuestionVotes: 0
                  };
                }
                questionAuthorStats[question.authorId].questionsAsked++;
                questionAuthorStats[question.authorId].totalQuestionVotes += question.votes || 0;
              }
            });

            const fallbackContributors = usersData
              .map(user => {
                const stats = questionAuthorStats[user.uid] || { questionsAsked: 0, totalQuestionVotes: 0 };
                const contributorScore = (stats.questionsAsked * 1) + (stats.totalQuestionVotes * 0.3);
                
                return {
                  ...user,
                  questionsAnswered: 0,
                  questionsAsked: stats.questionsAsked,
                  totalVotes: stats.totalQuestionVotes,
                  contributorScore,
                };
              })
              .filter(user => user.contributorScore > 0)
              .sort((a, b) => (b.contributorScore || 0) - (a.contributorScore || 0))
              .slice(0, 12);
            
            console.log('Fallback contributors:', fallbackContributors);
            setTopUsers(fallbackContributors);
          } else {
            setTopUsers(topContributors);
          }
        }

      } catch (error) {
        console.error('Error fetching explore data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExploreData();
  }, []);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    let currentRef: HTMLDivElement | null = null;
    let observer: IntersectionObserver | null = null;
    
    const setupObserver = () => {
      // Only set up observer if we have data and the potential for more
      const shouldObserve = (
        (activeTab === 'trending' && trendingQuestions.length > 0 && hasMoreTrending) ||
        (activeTab === 'recent' && recentQuestions.length > 0 && hasMoreRecent)
      );
      
      if (!shouldObserve) {
        return () => {}; // No cleanup needed if we don't set up observer
      }
      
      // Cleanup previous observer
      if (observer) {
        observer.disconnect();
      }
      
      observer = new IntersectionObserver(
        (entries) => {
          const target = entries[0];
          if (target.isIntersecting && !loadingMore) {
            if (activeTab === 'trending' && hasMoreTrending) {
              loadMoreTrending();
            } else if (activeTab === 'recent' && hasMoreRecent) {
              loadMoreRecent();
            }
          }
        },
        { threshold: 0.1 }
      );

      // Use multiple timeouts to ensure the DOM has rendered properly
      const timeoutId = setTimeout(() => {
        // Get the appropriate ref based on active tab
        if (activeTab === 'trending') {
          currentRef = trendingLoadMoreRef.current;
        } else if (activeTab === 'recent') {
          currentRef = recentLoadMoreRef.current;
        }
        
        if (currentRef && observer) {
          observer.observe(currentRef);
        } else {
          // If element is not found, try again after a longer delay
          const retryTimeoutId = setTimeout(() => {
            if (activeTab === 'trending') {
              currentRef = trendingLoadMoreRef.current;
            } else if (activeTab === 'recent') {
              currentRef = recentLoadMoreRef.current;
            }
            
            if (currentRef && observer) {
              observer.observe(currentRef);
            }
          }, 300);
          
          return () => clearTimeout(retryTimeoutId);
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (currentRef && observer) {
          observer.unobserve(currentRef);
        }
        if (observer) {
          observer.disconnect();
        }
      };
    };

    // Initial setup
    const cleanup = setupObserver();

    return cleanup;
  }, [activeTab, hasMoreTrending, hasMoreRecent, loadingMore, loadMoreTrending, loadMoreRecent, trendingQuestions.length, recentQuestions.length]);

  const formatTimeAgo = (timestamp: { seconds: number }) => {
    const now = new Date();
    const then = new Date(timestamp.seconds * 1000);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner message="Discovering amazing content..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore</h1>
        <p className="text-gray-600 mb-4">
          Discover trending questions (last 10 days), recent discussions, and top contributors based on answers and community votes
        </p>
        
        {/* Search Bar */}
        <div className="max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Search questions or people..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Press Enter to search</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('trending')}
            className={`${
              activeTab === 'trending'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            🔥 Trending
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`${
              activeTab === 'recent'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            ⏰ Recent
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            👥 Contributors
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'trending' && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">🔥 Trending Questions</h2>
            <p className="text-sm text-gray-600 mt-1">
              Questions with high engagement score based on votes, recency (last 10 days), and community interaction
            </p>
          </div>
          <div className="space-y-4">
            {trendingQuestions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No trending questions yet. Be the first to ask!</p>
                <Link
                  to="/ask"
                  className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Ask a Question
                </Link>
              </div>
            ) : (
              trendingQuestions.map((question, index) => (
                <div key={question.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl font-bold text-blue-600">#{index + 1}</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-500">{question.votes} votes</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-500">{question.answers || 0} answers</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          🔥 {(question.trendingScore || 0).toFixed(1)} trending
                        </span>
                      </div>
                      <Link
                        to={`/question/${question.id}`}
                        className="text-lg font-medium text-gray-900 hover:text-blue-600 block mb-2 whitespace-pre-wrap"
                      >
                        <RenderTextWithLinks
                          text={question.title}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </Link>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3 whitespace-pre-wrap">
                        <RenderTextWithLinks
                          text={question.content}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        <span>by</span>
                        <Link
                          to={`/@${question.username}`}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          @{question.username}
                        </Link>
                        <span className="mx-2">•</span>
                        <span>{formatTimeAgo(question.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Load more trigger and loading indicator for trending */}
            {(hasMoreTrending || loadingMore) && (
              <div ref={trendingLoadMoreRef} className="flex flex-col items-center py-4 space-y-3">
                {loadingMore && activeTab === 'trending' ? (
                  <LoadingSpinner message="Loading more questions..." />
                ) : (
                  <>
                    <div className="text-gray-500 text-sm">Scroll down to load more questions</div>
                    <button
                      onClick={loadMoreTrending}
                      className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      Load More Questions
                    </button>
                  </>
                )}
              </div>
            )}
            
            {!hasMoreTrending && trendingQuestions.length > 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                🎉 You've reached the end! No more trending questions to show.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'recent' && (
        <div>
          <h2 className="text-xl font-semibold mb-4">⏰ Recent Questions</h2>
          <div className="space-y-4">
            {recentQuestions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No questions yet. Start the conversation!</p>
                <Link
                  to="/ask"
                  className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Ask a Question
                </Link>
              </div>
            ) : (
              recentQuestions.map((question) => (
                <div key={question.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm text-gray-500">{question.votes} votes</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-gray-500">{question.answers || 0} answers</span>
                        <span className="text-sm text-gray-500">•</span>
                        <span className="text-sm text-green-600 font-medium">{formatTimeAgo(question.createdAt)}</span>
                      </div>
                      <Link
                        to={`/question/${question.id}`}
                        className="text-lg font-medium text-gray-900 hover:text-blue-600 block mb-2 whitespace-pre-wrap"
                      >
                        <RenderTextWithLinks
                          text={question.title}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </Link>
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3 whitespace-pre-wrap">
                        <RenderTextWithLinks
                          text={question.content}
                          availableUsers={availableUsers}
                          onHashtagClick={handleHashtagClick}
                          onMentionClick={handleMentionClick}
                        />
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        <span>by</span>
                        <Link
                          to={`/@${question.username}`}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          @{question.username}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Load more trigger and loading indicator for recent */}
            {(hasMoreRecent || loadingMore) && (
              <div ref={recentLoadMoreRef} className="flex flex-col items-center py-4 space-y-3">
                {loadingMore && activeTab === 'recent' ? (
                  <LoadingSpinner message="Loading more questions..." />
                ) : (
                  <>
                    <div className="text-gray-500 text-sm">Scroll down to load more questions</div>
                    <button
                      onClick={loadMoreRecent}
                      className="px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      Load More Questions
                    </button>
                  </>
                )}
              </div>
            )}
            
            {!hasMoreRecent && recentQuestions.length > 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                🎉 You've reached the end! No more recent questions to show.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold">👥 Top Contributors</h2>
            <p className="text-sm text-gray-600 mt-1">
              Community members ranked by their contributions. Contributors who have answered questions: score = (Answers × 2) + (Total Votes × 0.5). 
              For new communities: score = (Questions Asked × 1) + (Question Votes × 0.3).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {topUsers.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No contributors yet. Join the community!</p>
              </div>
            ) : (
              topUsers.map((user, index) => (
                <div key={user.uid} className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow relative">
                  {/* Ranking badge */}
                  {index < 3 && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index === 0 && <span className="bg-yellow-500 w-full h-full rounded-full flex items-center justify-center">🥇</span>}
                      {index === 1 && <span className="bg-gray-400 w-full h-full rounded-full flex items-center justify-center">🥈</span>}
                      {index === 2 && <span className="bg-amber-600 w-full h-full rounded-full flex items-center justify-center">🥉</span>}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-white font-bold">
                        {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">
                      {user.displayName || 'Anonymous User'}
                    </h3>
                    
                    <Link
                      to={`/@${user.username}`}
                      className="text-sm text-blue-600 hover:text-blue-800 mb-3 block"
                    >
                      @{user.username}
                    </Link>

                    {/* Contributor Stats */}
                    <div className="space-y-2 mb-4">
                      {(user.questionsAnswered || 0) > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Questions Answered:</span>
                            <span className="font-semibold text-blue-600">{user.questionsAnswered || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Total Votes:</span>
                            <span className="font-semibold text-green-600">{user.totalVotes || 0}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Questions Asked:</span>
                            <span className="font-semibold text-blue-600">{user.questionsAsked || 0}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Question Votes:</span>
                            <span className="font-semibold text-green-600">{user.totalVotes || 0}</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Contributor Score:</span>
                        <span className="font-bold text-purple-600">{(user.contributorScore || 0).toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Progress bar for contributor score */}
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(100, ((user.contributorScore || 0) / Math.max(1, topUsers[0]?.contributorScore || 1)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    
                    <Link
                      to={`/@${user.username}`}
                      className="inline-block text-xs bg-blue-50 text-blue-600 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors font-medium"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Explore;
