import React, { useState, useEffect, useRef } from 'react';
import { type User } from '../utils/textUtils';

interface MentionDropdownProps {
  users: User[];
  searchTerm: string;
  position: { top: number; left: number };
  onUserSelect: (user: User) => void;
  onClose: () => void;
  isVisible: boolean;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  users,
  searchTerm,
  position,
  onUserSelect,
  onClose,
  isVisible
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(position);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update position when prop changes
  useEffect(() => {
    setCurrentPosition(position);
  }, [position]);

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.username && 
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5); // Show top 5 users

  // Reset selected index when search term changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchTerm]);

  // Handle scrolling - hide dropdown when scrolling outside of dropdown
  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (isVisible) {
        // Check if the scroll event is happening within our dropdown
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
          // Allow scrolling within the dropdown - don't close it
          return;
        }
        // Close dropdown only if scrolling outside of it
        onClose();
      }
    };

    if (isVisible) {
      // Listen to scroll on window and all scrollable containers
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isVisible, onClose]);

  // Handle window resize - hide dropdown
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        onClose();
      }
    };

    if (isVisible) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isVisible, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || filteredUsers.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onUserSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, filteredUsers, selectedIndex, onUserSelect, onClose]);

  // Click outside to close or focus loss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Check if the new focus target is not related to our dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(e.relatedTarget as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('focusout', handleFocusOut);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('focusout', handleFocusOut);
      };
    }
  }, [isVisible, onClose]);

  // Ensure dropdown stays within viewport bounds
  const getAdjustedPosition = () => {
    const dropdownWidth = 300; // max-width in pixels
    const dropdownHeight = 200; // estimated height
    const padding = 10;

    let adjustedTop = currentPosition.top;
    let adjustedLeft = currentPosition.left;

    // Check if dropdown goes beyond right edge of viewport
    if (adjustedLeft + dropdownWidth > window.innerWidth - padding) {
      adjustedLeft = window.innerWidth - dropdownWidth - padding;
    }

    // Check if dropdown goes beyond left edge of viewport
    if (adjustedLeft < padding) {
      adjustedLeft = padding;
    }

    // Check if dropdown goes beyond bottom edge of viewport
    if (adjustedTop + dropdownHeight > window.innerHeight - padding) {
      adjustedTop = currentPosition.top - dropdownHeight - 30; // Show above cursor
    }

    // Check if dropdown goes beyond top edge of viewport
    if (adjustedTop < padding) {
      adjustedTop = padding;
    }

    return { top: adjustedTop, left: adjustedLeft };
  };

  if (!isVisible || filteredUsers.length === 0) {
    return null;
  }

  const adjustedPosition = getAdjustedPosition();

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-w-xs"
      style={{
        top: adjustedPosition.top,
        left: adjustedPosition.left,
        maxHeight: '200px',
        maxWidth: '300px',
        minWidth: '250px'
      }}
    >
      <div className="p-2">
        <div className="text-xs text-gray-500 mb-2 px-2">
          Select user to mention
        </div>
        <div 
          className="max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          style={{ maxHeight: '128px' }}
        >
          {filteredUsers.map((user, index) => (
            <div
              key={user.uid}
              className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                index === selectedIndex 
                  ? 'bg-blue-50 border border-blue-200' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => onUserSelect(user)}
            >
              <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2">
                {user.username?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  @{user.username}
                </div>
                {user.displayName && user.displayName !== user.username && (
                  <div className="text-xs text-gray-500 truncate">
                    {user.displayName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-gray-100 p-2 bg-gray-50 text-xs text-gray-500">
        Use ↑↓ to navigate, Enter to select, Esc to cancel
      </div>
    </div>
  );
};

export default MentionDropdown;
