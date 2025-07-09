// Enhanced interface for users with better typing
export interface User {
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
 * Enhanced to handle more complex scenarios
 */
export const parseTextWithTagsAndMentions = (text: string, availableUsers: User[]): ParsedSegment[] => {
  if (!text) return [];
  
  const segments: ParsedSegment[] = [];
  // Enhanced regex to capture hashtags and mentions more accurately
  const regex = /(?:^|\s)(#\w+)|(?:^|\s)(@\w+)/g;
  let lastIndex = 0;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const hashtag = match[1];
    const mention = match[2];
    const matchStart = match.index;
    const actualStart = hashtag ? matchStart + fullMatch.indexOf('#') : matchStart + fullMatch.indexOf('@');
    
    // Add text before the match
    if (actualStart > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, actualStart)
      });
    }

    // Add the matched hashtag or mention
    if (hashtag) {
      segments.push({
        type: 'hashtag',
        content: hashtag.slice(1), // Remove the #
        isValid: true
      });
      lastIndex = actualStart + hashtag.length;
    } else if (mention) {
      const username = mention.slice(1); // Remove the @
      const userExists = availableUsers.some(user => 
        user.username && user.username.toLowerCase() === username.toLowerCase()
      );
      segments.push({
        type: 'mention',
        content: username,
        isValid: userExists
      });
      lastIndex = actualStart + mention.length;
    }
  }

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

export type { ParsedSegment };
