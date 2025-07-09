import React from 'react';
import { parseTextWithTagsAndMentions, type User } from './textUtils';

interface RenderTextWithLinksProps {
  text: string;
  availableUsers: User[];
  onHashtagClick: (tag: string) => void;
  onMentionClick: (username: string) => void;
  preserveWhitespace?: boolean;
}

/**
 * Component to render text with clickable hashtags and mentions
 */
export const RenderTextWithLinks: React.FC<RenderTextWithLinksProps> = ({
  text,
  availableUsers,
  onHashtagClick,
  onMentionClick,
  preserveWhitespace = true
}) => {
  const segments = parseTextWithTagsAndMentions(text, availableUsers);

  return (
    <span className={preserveWhitespace ? 'whitespace-pre-wrap' : ''}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'hashtag':
            return (
              <button
                key={index}
                onClick={() => onHashtagClick(segment.content)}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                title={`Search for #${segment.content}`}
              >
                #{segment.content}
              </button>
            );
          
          case 'mention':
            if (segment.isValid) {
              return (
                <button
                  key={index}
                  onClick={() => onMentionClick(segment.content)}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                  title={`View @${segment.content}'s profile`}
                >
                  @{segment.content}
                </button>
              );
            } else {
              return (
                <span key={index} className="text-gray-600">
                  @{segment.content}
                </span>
              );
            }
          
          default:
            return <span key={index}>{segment.content}</span>;
        }
      })}
    </span>
  );
};
