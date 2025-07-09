import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { FiSearch, FiUser, FiMessageSquare, FiX, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

interface Question {
  id: string;
  title: string;
  content: string;
  authorId: string;
  username?: string;
  author?: string;
  createdAt: { seconds: number };
  votes: number;
  answers: number;
  tags?: string[]; // Add tags property
}

interface User {
  uid: string;
  username: string;
  displayName: string;
}

// Utility functions for parsing hashtags and mentions
const parseTextWithTagsAndMentions = (text: string, availableUsers: User[] = []) => {
  // Regular expressions for hashtags and mentions
  const hashtagRegex = /#([a-zA-Z0-9-]+)/g;
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  
  const parts: Array<{type: string; content: string; value?: string}> = [];
  let lastIndex = 0;
  
  // Find all hashtags and mentions
  const matches: Array<{type: string; index: number; length: number; value: string; fullMatch: string}> = [];
  
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    matches.push({
      type: 'hashtag',
      index: match.index,
      length: match[0].length,
      value: match[1],
      fullMatch: match[0]
    });
  }
  
  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1];
    // Check if the username exists in available users
    const userExists = availableUsers.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (userExists) {
      matches.push({
        type: 'mention',
        index: match.index,
        length: match[0].length,
        value: username,
        fullMatch: match[0]
      });
    }
  }
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);
  
  // Build the parts array
  matches.forEach((match) => {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Add the match
    parts.push({
      type: match.type,
      content: match.fullMatch,
      value: match.value
    });
    
    lastIndex = match.index + match.length;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

// Component to render parsed text with clickable hashtags and mentions
const RenderTextWithLinks = ({ text, availableUsers = [], onHashtagClick, onMentionClick }: {
  text: string;
  availableUsers?: User[];
  onHashtagClick?: (tag: string) => void;
  onMentionClick?: (username: string) => void;
}) => {
  const parts = parseTextWithTagsAndMentions(text, availableUsers);
  
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.type === 'hashtag') {
          return (
            <button
              key={index}
              onClick={() => onHashtagClick?.(part.value || '')}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer inline"
            >
              {part.content}
            </button>
          );
        } else if (part.type === 'mention') {
          return (
            <Link
              key={index}
              to={`/@${part.value || ''}`}
              onClick={() => onMentionClick?.(part.value || '')}
              className="text-blue-600 hover:text-blue-800 hover:underline inline"
            >
              {part.content}
            </Link>
          );
        } else {
          return <span key={index} className="inline">{part.content}</span>;
        }
      })}
    </div>
  );
};

const RESULTS_PER_PAGE = 15;

const Search = () => {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'questions' | 'users'>('questions');
  const [searchBy, setSearchBy] = useState<'all' | 'tags'>('all'); // New state for search mode
  const [questions, setQuestions] = useState<Question[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [popularTags, setPopularTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  
  // Separate pagination state for questions and users
  const [questionsPage, setQuestionsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Fetch popular tags on component mount
  useEffect(() => {
    const fetchPopularTags = async () => {
      try {
        setTagsLoading(true);
        const questionsSnap = await getDocs(collection(db, 'questions'));
        const allTags: string[] = [];
        
        questionsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.tags && Array.isArray(data.tags)) {
            allTags.push(...data.tags);
          }
        });
        
        // Count tag frequencies
        const tagCounts = allTags.reduce((acc, tag) => {
          if (tag && tag.trim()) {
            const normalizedTag = tag.trim();
            acc[normalizedTag] = (acc[normalizedTag] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        
        // Sort by frequency and get top 15 tags
        const sortedTags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
          .map(([tag]) => tag);
        
        // If no tags found, use default fallback tags
        const fallbackTags = [
          'React', 'JavaScript', 'TypeScript', 'Programming', 'Web Development',
          'Career Advice', 'Coding Interview', 'Database', 'CSS', 'Open Source'
        ];
        
        setPopularTags(sortedTags.length > 0 ? sortedTags : fallbackTags);
      } catch (error) {
        console.error('Error fetching tags:', error);
        // Use fallback tags on error
        setPopularTags([
          'React', 'JavaScript', 'TypeScript', 'Programming', 'Web Development',
          'Career Advice', 'Coding Interview', 'Database', 'CSS', 'Open Source'
        ]);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchPopularTags();
  }, []);

  // Fetch available users for mentions
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData = usersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        })) as User[];
        setAvailableUsers(usersData);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Pagination helper
  const paginateResults = <T extends unknown[]>(results: T, page: number): T => {
    const startIndex = (page - 1) * RESULTS_PER_PAGE;
    const endIndex = startIndex + RESULTS_PER_PAGE;
    return results.slice(startIndex, endIndex) as T;
  };

  // Get current pagination values based on search type
  const currentPage = searchType === 'questions' ? questionsPage : usersPage;
  const setCurrentPage = searchType === 'questions' ? setQuestionsPage : setUsersPage;
  const totalResults = searchType === 'questions' ? totalQuestions : totalUsers;

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(totalResults / RESULTS_PER_PAGE)) {
      setCurrentPage(newPage);
      if (searchType === 'questions') {
        setQuestions(paginateResults(allQuestions, newPage));
      } else {
        setUsers(paginateResults(allUsers, newPage));
      }
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);
  const showPagination = totalResults > RESULTS_PER_PAGE;

  const performSearch = useCallback(async (term: string, type: 'questions' | 'users', searchMode: 'all' | 'tags' = 'all') => {
    if (!term.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    // Reset the appropriate page to 1
    if (type === 'questions') {
      setQuestionsPage(1);
    } else {
      setUsersPage(1);
    }
    
    try {
      if (type === 'questions') {
        // Search questions by title or content
        const questionsSnap = await getDocs(collection(db, 'questions'));
        const allQuestionsRaw = questionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Question[];
        
        // Fetch usernames for questions that don't have them
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
        
        // Enhance questions with usernames
        const allQuestionsEnhanced = allQuestionsRaw.map(question => ({
          ...question,
          username: question.username || userMap[question.authorId] || 'unknown',
        }));
        
        // Filter questions based on search mode
        let searchLower = term.toLowerCase();
        let filteredQuestions: Question[];
        
        // If term starts with #, remove it for tag search
        if (searchLower.startsWith('#')) {
          searchLower = searchLower.substring(1);
        }
        
        if (searchMode === 'tags' || term.startsWith('#')) {
          // Tag-specific search: match questions that have this exact tag
          filteredQuestions = allQuestionsEnhanced.filter(question => {
            const tags = question.tags;
            if (!tags || !Array.isArray(tags)) return false;
            return tags.some((tag: string) => 
              tag.toLowerCase() === searchLower || 
              tag.toLowerCase().includes(searchLower)
            );
          });
        } else {
          // General search: search in title, content, username, and tags
          filteredQuestions = allQuestionsEnhanced.filter(question => {
            const titleMatch = question.title.toLowerCase().includes(searchLower);
            const contentMatch = question.content.toLowerCase().includes(searchLower);
            const usernameMatch = question.username && question.username.toLowerCase().includes(searchLower);
            const authorMatch = question.author && question.author.toLowerCase().includes(searchLower);
            
            // Also search in tags for general search
            const tags = question.tags;
            const tagMatch = tags && Array.isArray(tags) && 
              tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
            
            return titleMatch || contentMatch || usernameMatch || authorMatch || tagMatch;
          });
        }
        
        // Sort by relevance and recency
        filteredQuestions.sort((a, b) => {
          // Calculate relevance score
          const getRelevanceScore = (question: Question) => {
            let score = 0;
            const titleLower = question.title.toLowerCase();
            const contentLower = question.content.toLowerCase();
            const tags = question.tags;
            
            if (searchMode === 'tags' || term.startsWith('#')) {
              // For tag search, prioritize exact tag matches
              if (tags && Array.isArray(tags)) {
                const exactMatch = tags.some((tag: string) => tag.toLowerCase() === searchLower);
                const partialMatch = tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
                
                if (exactMatch) score += 100;
                else if (partialMatch) score += 50;
              }
            } else {
              // For general search, use existing relevance logic
              if (titleLower === searchLower) score += 100;
              else if (titleLower.startsWith(searchLower)) score += 50;
              else if (titleLower.includes(searchLower)) score += 25;
              
              if (contentLower.includes(searchLower)) score += 10;
              
              if (question.username && question.username.toLowerCase().includes(searchLower)) score += 15;
              if (question.author && question.author.toLowerCase().includes(searchLower)) score += 15;
              
              // Tag matches in general search
              if (tags && Array.isArray(tags)) {
                const tagMatch = tags.some((tag: string) => tag.toLowerCase().includes(searchLower));
                if (tagMatch) score += 20;
              }
            }
            
            // Boost by votes and answers
            score += (question.votes || 0) * 0.5;
            score += (question.answers || 0) * 0.3;
            
            return score;
          };
          
          const scoreA = getRelevanceScore(a);
          const scoreB = getRelevanceScore(b);
          
          if (scoreA !== scoreB) {
            return scoreB - scoreA; // Higher score first
          }
          
          // If scores are equal, sort by creation date (newer first)
          if (a.createdAt && b.createdAt) {
            return b.createdAt.seconds - a.createdAt.seconds;
          }
          
          return 0;
        });
        
        setAllQuestions(filteredQuestions);
        setTotalQuestions(filteredQuestions.length);
        setQuestions(paginateResults(filteredQuestions, 1));
        setUsers([]);
      } else {
        // Search users by username or display name
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsersData = usersSnap.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        })) as User[];
        
        // Filter users that match search term
        const filteredUsers = allUsersData.filter(user =>
          user.username.toLowerCase().includes(term.toLowerCase()) ||
          user.displayName.toLowerCase().includes(term.toLowerCase())
        );
        
        setAllUsers(filteredUsers);
        setTotalUsers(filteredUsers.length);
        setUsers(paginateResults(filteredUsers, 1));
        setQuestions([]);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  // Handle URL parameters
  useEffect(() => {
    const query = searchParams.get('q');
    const type = searchParams.get('type');
    const searchByParam = searchParams.get('searchBy');
    
    if (query) {
      setSearchTerm(query);
      if (type === 'users') {
        setSearchType('users');
      } else {
        setSearchType('questions');
      }
      
      // Set search mode based on URL parameter
      const searchMode = searchByParam === 'tags' ? 'tags' : 'all';
      setSearchBy(searchMode);
      
      // Trigger search automatically
      performSearch(query, type === 'users' ? 'users' : 'questions', searchMode);
    }
  }, [searchParams, performSearch]);

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Detect hashtag search and switch to tag mode
    if (value.startsWith('#') && searchType === 'questions') {
      setSearchBy('tags');
    } else if (!value.startsWith('#') && searchBy === 'tags' && searchType === 'questions') {
      // Only switch back if it's not a direct hashtag search
      setSearchBy('all');
    }
    
    // If search term is cleared, reset search state
    if (!value.trim() && hasSearched) {
      setHasSearched(false);
      setQuestions([]);
      setUsers([]);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setHasSearched(false);
    setQuestions([]);
    setUsers([]);
  };

  // Handle search type change - show the appropriate page 1 results
  const handleSearchTypeChange = (newType: 'questions' | 'users') => {
    setSearchType(newType);
    
    // If we have search results, show page 1 of the new type
    if (hasSearched && searchTerm.trim()) {
      if (newType === 'questions') {
        setQuestions(paginateResults(allQuestions, 1));
      } else {
        setUsers(paginateResults(allUsers, 1));
      }
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    // Use the performSearch function which handles the searchBy parameter
    performSearch(searchTerm, searchType, searchBy);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      clearSearch();
    }
  };

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

  // Handler for hashtag clicks
  const handleHashtagClick = (tag: string) => {
    setSearchTerm(tag);
    setSearchBy('tags');
    setSearchType('questions');
    performSearch(tag, 'questions', 'tags');
  };

  // Handler for mention clicks
  const handleMentionClick = (username: string) => {
    // Navigation is handled by the Link component
    console.log('Navigating to user profile:', username);
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search</h1>
        <p className="text-gray-600">Find questions, answers, and people in the community</p>
      </div>

      {/* Search Interface */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 mb-6">
        {/* Search Type Toggle */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => handleSearchTypeChange('questions')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium ${
              searchType === 'questions'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FiMessageSquare className="w-4 h-4" />
            <span>Questions</span>
          </button>
          <button
            onClick={() => handleSearchTypeChange('users')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium ${
              searchType === 'users'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FiUser className="w-4 h-4" />
            <span>People</span>
          </button>
        </div>

        {/* Search Mode Toggle for Questions */}
        {searchType === 'questions' && (
          <div className="flex space-x-2 mb-4">
            <span className="text-sm text-gray-600 flex items-center">Search by:</span>
            <button
              onClick={() => setSearchBy('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                searchBy === 'all'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              All Content
            </button>
            <button
              onClick={() => setSearchBy('tags')}
              className={`px-3 py-1 text-xs font-medium rounded-full ${
                searchBy === 'tags'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              Tags Only
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchTermChange}
              onKeyPress={handleKeyPress}
              placeholder={
                searchType === 'questions'
                  ? searchBy === 'tags' 
                    ? 'Search by tags (e.g., JavaScript, React, Programming)...'
                    : 'Search for questions, topics, or authors...'
                  : 'Search for people by name or username...'
              }
              title="Press Enter to search, Escape to clear"
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={!searchTerm.trim() || loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-32">
          <LoadingSpinner message="Searching..." />
        </div>
      )}

      {/* Search Results */}
      {!loading && hasSearched && (
        <div>
          {searchType === 'questions' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {totalResults > 0 
                    ? `Found ${totalResults} question${totalResults !== 1 ? 's' : ''} for "${searchTerm}"`
                    : `No questions found for "${searchTerm}"`
                  }
                </h2>
                <button
                  onClick={clearSearch}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                >
                  <FiX className="w-4 h-4" />
                  <span>Clear results</span>
                </button>
              </div>
              
              {questions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <FiMessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No questions match your search.</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Try different keywords or browse all questions.
                  </p>
                  <Link
                    to="/"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Browse All Questions
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div key={question.id} className="bg-white shadow-sm border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm text-gray-500">{question.votes || 0} votes</span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500">{question.answers || 0} answers</span>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm text-gray-500">{formatTimeAgo(question.createdAt)}</span>
                          </div>
                          <Link
                            to={`/question/${question.id}`}
                            className="text-lg font-medium text-gray-900 hover:text-blue-600 block mb-2"
                          >
                            <RenderTextWithLinks 
                              text={question.title}
                              availableUsers={availableUsers}
                              onHashtagClick={handleHashtagClick}
                              onMentionClick={handleMentionClick}
                            />
                          </Link>
                          <div className="text-gray-600 text-sm mb-3 max-h-20 overflow-hidden">
                            <RenderTextWithLinks 
                              text={question.content}
                              availableUsers={availableUsers}
                              onHashtagClick={handleHashtagClick}
                              onMentionClick={handleMentionClick}
                            />
                          </div>
                          {question.tags && question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {question.tags.slice(0, 3).map((tag, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleHashtagClick(tag)}
                                  className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-full hover:bg-blue-100 cursor-pointer transition-colors"
                                >
                                  {tag}
                                </button>
                              ))}
                              {question.tags.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                  +{question.tags.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
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
                  ))}
                </div>
              )}
              
              {/* Pagination for Questions */}
              {showPagination && questions.length > 0 && (
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * RESULTS_PER_PAGE) + 1} to {Math.min(currentPage * RESULTS_PER_PAGE, totalResults)} of {totalResults} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (currentPage <= 4) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              pageNum === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <FiChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {totalResults > 0 
                    ? `Found ${totalResults} user${totalResults !== 1 ? 's' : ''} for "${searchTerm}"`
                    : `No users found for "${searchTerm}"`
                  }
                </h2>
                <button
                  onClick={clearSearch}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                >
                  <FiX className="w-4 h-4" />
                  <span>Clear results</span>
                </button>
              </div>
              
              {users.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <FiUser className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">No users match your search.</p>
                  <p className="text-sm text-gray-400">
                    Try different keywords or browse all contributors.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {users.map((user) => (
                    <div key={user.uid} className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="text-center">
                        <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                          <span className="text-xl text-gray-600">
                            {user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900">{user.displayName || 'Anonymous User'}</h3>
                        <Link
                          to={`/@${user.username}`}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          @{user.username}
                        </Link>
                        <div className="mt-3">
                          <Link
                            to={`/@${user.username}`}
                            className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-100"
                          >
                            View Profile
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination for Users */}
              {showPagination && users.length > 0 && (
                <div className="mt-8 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * RESULTS_PER_PAGE) + 1} to {Math.min(currentPage * RESULTS_PER_PAGE, totalResults)} of {totalResults} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 7) {
                          pageNum = i + 1;
                        } else if (currentPage <= 4) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 3) {
                          pageNum = totalPages - 6 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              pageNum === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <FiChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial State - Show search suggestions */}
      {!hasSearched && !loading && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {searchType === 'questions' ? 'Popular Search Topics' : 'Quick Search Tips'}
          </h3>
          
          {searchType === 'questions' ? (
            <>
              {tagsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner message="Loading popular topics..." />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => handleHashtagClick(topic)}
                      className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-400 transition-colors"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-sm text-gray-500 mt-3">
                Click on any topic to search for related questions, or type your own search term.
              </p>
            </>
          ) : (
            <div className="text-gray-600">
              <p className="mb-2">• Search by username (e.g., "john_doe")</p>
              <p className="mb-2">• Search by display name (e.g., "John Doe")</p>
              <p>• Use partial matches to find users more easily</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Search;
