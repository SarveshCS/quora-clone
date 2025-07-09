// Enhanced interface for users with better typing
interface User {
  uid: string;
  username: string;
  displayName?: string;
}

interface ParsedSegment {
  type: 'text' | 'hashtag' | 'mention';
  content: string;
  isValid?: boolean;
}

/**
 * Parse text and identify hashtags (#tag) and mentions (@username)
 */
export const parseTextWithTagsAndMentions = (text: string, availableUsers: User[]): ParsedSegment[] => {
  if (!text) return [];
  
  const segments: ParsedSegment[] = [];
  const regex = /(#\w+|@\w+)/g;
  let lastIndex = 0;

  text.replace(regex, (match, _, index) => {
    // Add text before the match
    if (index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, index)
      });
    }

    // Add the matched hashtag or mention
    if (match.startsWith('#')) {
      segments.push({
        type: 'hashtag',
        content: match.slice(1), // Remove the #
        isValid: true
      });
    } else if (match.startsWith('@')) {
      const username = match.slice(1); // Remove the @
      const userExists = availableUsers.some(user => 
        user.username && user.username.toLowerCase() === username.toLowerCase()
      );
      segments.push({
        type: 'mention',
        content: username,
        isValid: userExists
      });
    }

    lastIndex = index + match.length;
    return match;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  return segments;
};

/**
 * Default hashtag click handler that navigates to search
 */
export const createHashtagClickHandler = (navigate: (path: string) => void) => {
  return (tag: string) => {
    navigate(`/search?q=${encodeURIComponent(tag)}&type=questions&searchBy=tags`);
  };
};

/**
 * Default mention click handler that navigates to user profile
 */
export const createMentionClickHandler = (navigate: (path: string) => void) => {
  return (username: string) => {
    navigate(`/@${username}`);
  };
};

export type { User, ParsedSegment };
