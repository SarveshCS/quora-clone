import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiHome, FiCompass, FiSearch, FiMenu, FiX } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      setMobileMenuOpen(false);
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between h-14 sm:h-16">
          {/* Left side - Logo and Desktop Navigation */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center" onClick={closeMobileMenu}>
              <span className="text-base sm:text-lg lg:text-xl font-bold text-blue-600 truncate">Quora Clone</span>
            </Link>
            
            {/* Desktop Navigation Icons - Hidden on mobile */}
            <div className="hidden md:flex items-center ml-4 lg:ml-6 space-x-1 lg:space-x-2">
              <Link to="/" className="p-1.5 lg:p-2 hover:bg-gray-100 rounded-full transition-colors" title="Home">
                <FiHome className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              </Link>
              <Link to="/explore" className="p-1.5 lg:p-2 hover:bg-gray-100 rounded-full transition-colors" title="Explore">
                <FiCompass className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              </Link>
              <Link to="/search" className="p-1.5 lg:p-2 hover:bg-gray-100 rounded-full transition-colors" title="Search">
                <FiSearch className="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
              </Link>
            </div>
          </div>
          
          {/* Right side - Desktop User Actions */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
            {currentUser ? (
              <>
                <Link 
                  to="/ask" 
                  className="px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Ask Question
                </Link>
                <Link 
                  to={username ? `/u/${username}` : '#'} 
                  className={`text-gray-700 hover:text-gray-900 px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${!username ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={!username ? (e) => e.preventDefault() : undefined}
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-gray-900 px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="text-gray-700 hover:text-gray-900 px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="px-2 lg:px-3 py-1.5 text-xs lg:text-sm font-medium text-blue-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <FiX className="w-5 h-5" />
              ) : (
                <FiMenu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white shadow-lg">
            <div className="px-3 py-3 space-y-2 max-h-screen overflow-y-auto">
              {/* Mobile Navigation Links */}
              <Link 
                to="/" 
                className="flex items-center px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                onClick={closeMobileMenu}
              >
                <FiHome className="w-5 h-5 mr-3 text-gray-500" />
                <span className="font-medium">Home</span>
              </Link>
              <Link 
                to="/explore" 
                className="flex items-center px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                onClick={closeMobileMenu}
              >
                <FiCompass className="w-5 h-5 mr-3 text-gray-500" />
                <span className="font-medium">Explore</span>
              </Link>
              <Link 
                to="/search" 
                className="flex items-center px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                onClick={closeMobileMenu}
              >
                <FiSearch className="w-5 h-5 mr-3 text-gray-500" />
                <span className="font-medium">Search</span>
              </Link>

              {/* Mobile User Actions */}
              {currentUser ? (
                <>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <Link 
                      to="/ask" 
                      className="flex items-center justify-center w-full px-3 py-3 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors"
                      onClick={closeMobileMenu}
                    >
                      Ask Question
                    </Link>
                  </div>
                  <Link 
                    to={username ? `/u/${username}` : '#'} 
                    className={`flex items-center px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors ${!username ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={!username ? (e) => e.preventDefault() : closeMobileMenu}
                  >
                    <span className="font-medium">Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full text-left px-3 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <span className="font-medium">Logout</span>
                  </button>
                </>
              ) : (
                <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                  <Link 
                    to="/login" 
                    className="block px-3 py-2.5 text-center text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors font-medium"
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>
                  <Link 
                    to="/register" 
                    className="block px-3 py-2.5 text-center text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md font-medium transition-colors"
                    onClick={closeMobileMenu}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
