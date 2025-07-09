import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiHome, FiCompass, FiSearch } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    const fetchUsername = async () => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUsername(userDoc.data().username || '');
          }
        } catch (error) {
          console.error('Error fetching username:', error);
        }
      }
    };
    fetchUsername();
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-blue-600">Quora Clone</span>
            </Link>
            {/* Quora-style icons */}
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full" title="Home">
              <FiHome className="w-6 h-6 text-gray-600" />
            </Link>
            <Link to="/explore" className="p-2 hover:bg-gray-100 rounded-full" title="Explore">
              <FiCompass className="w-6 h-6 text-gray-600" />
            </Link>
            <Link to="/search" className="p-2 hover:bg-gray-100 rounded-full" title="Search">
              <FiSearch className="w-6 h-6 text-gray-600" />
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <>
                <Link 
                  to="/ask" 
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Ask Question
                </Link>
                <Link 
                  to={username ? `/u/${username}` : '#'} 
                  className={`text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium ${!username ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={!username ? (e) => e.preventDefault() : undefined}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
