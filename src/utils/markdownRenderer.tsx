import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import rehypeExternalLinks from 'rehype-external-links';
import { parseTextWithTagsAndMentions, type User } from './textUtils';
import ImageModal from '../components/ImageModal';

interface MarkdownRendererProps {
  content: string;
  availableUsers: User[];
  onHashtagClick: (tag: string) => void;
  onMentionClick: (username: string) => void;
  className?: string;
}

/**
 * Custom renderer for text nodes that handles hashtags and mentions
 * Enhanced to handle more text patterns
 */
const TextRenderer = ({ 
  children, 
  availableUsers, 
  onHashtagClick, 
  onMentionClick 
}: {
  children: string;
  availableUsers: User[];
  onHashtagClick: (tag: string) => void;
  onMentionClick: (username: string) => void;
}) => {
  if (!children || typeof children !== 'string') {
    return <>{children}</>;
  }

  const segments = parseTextWithTagsAndMentions(children, availableUsers);

  return (
    <>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'hashtag':
            return (
              <span
                key={index}
                onClick={() => onHashtagClick(segment.content)}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors duration-200 inline-block"
                title={`Search for #${segment.content}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onHashtagClick(segment.content);
                  }
                }}
              >
                #{segment.content}
              </span>
            );
          
          case 'mention':
            if (segment.isValid) {
              return (
                <span
                  key={index}
                  onClick={() => onMentionClick(segment.content)}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors duration-200 inline-block"
                  title={`View @${segment.content}'s profile`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMentionClick(segment.content);
                    }
                  }}
                >
                  @{segment.content}
                </span>
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
    </>
  );
};

/**
 * Enhanced markdown renderer with hashtag and mention support
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  availableUsers,
  onHashtagClick,
  onMentionClick,
  className = ''
}) => {
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    src: string;
    alt?: string;
    title?: string;
  }>({
    isOpen: false,
    src: '',
    alt: '',
    title: ''
  });

  const openImageModal = (src: string, alt?: string, title?: string) => {
    setImageModal({
      isOpen: true,
      src,
      alt,
      title
    });
  };

  const closeImageModal = () => {
    setImageModal({
      isOpen: false,
      src: '',
      alt: '',
      title: ''
    });
  };

  if (!content) return null;

  return (
    <>
      <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[
          rehypeSanitize,
          [rehypeExternalLinks, { target: '_blank', rel: 'noopener noreferrer' }]
        ]}
        components={{
          // Handle text nodes for hashtags and mentions in all contexts
          text: ({ children }) => (
            <TextRenderer
              children={children as string}
              availableUsers={availableUsers}
              onHashtagClick={onHashtagClick}
              onMentionClick={onMentionClick}
            />
          ),
          // Enhanced link renderer with better styling and security
          a: ({ href, children, title, ...props }) => (
            <a
              href={href}
              title={title}
              {...props}
              className="text-blue-600 hover:text-blue-800 underline decoration-1 hover:decoration-2 transition-all duration-200"
              target={href?.startsWith('http') ? '_blank' : undefined}
              rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          ),
          // Enhanced image renderer with better styling and error handling
          img: ({ src, alt, title, ...props }) => (
            <div className="my-4 text-center">
              <img
                src={src}
                alt={alt || 'Image'}
                title={title}
                {...props}
                className="max-w-full h-auto rounded-lg shadow-md mx-auto border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow duration-200"
                style={{ maxHeight: '500px', objectFit: 'contain' }}
                loading="lazy"
                onClick={() => openImageModal(src || '', alt, title)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'bg-gray-100 border border-gray-300 rounded-lg p-4 text-gray-500 text-sm';
                  errorDiv.innerHTML = `<span>❌ Failed to load image: ${alt || src}</span>`;
                  target.parentNode?.replaceChild(errorDiv, target);
                }}
              />
              {title && (
                <p className="text-sm text-gray-600 mt-2 italic">{title}</p>
              )}
            </div>
          ),
          // Enhanced code styling with better syntax highlighting simulation
          code: ({ children, className, ...props }) => {
            const isInline = !className;
            const language = className?.replace('language-', '') || '';
            
            return (
              <code
                className={`${
                  isInline
                    ? 'bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono'
                    : `block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed ${className || ''}`
                } border border-gray-200`}
                {...props}
              >
                {isInline ? (
                  children
                ) : (
                  <div>
                    {language && (
                      <div className="text-gray-400 text-xs mb-2 uppercase tracking-wide">
                        {language}
                      </div>
                    )}
                    {children}
                  </div>
                )}
              </code>
            );
          },
          // Enhanced pre wrapper for code blocks
          pre: ({ children, ...props }) => (
            <div className="relative my-4">
              <pre
                className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden"
                {...props}
              >
                {children}
              </pre>
            </div>
          ),
          // Enhanced blockquote styling with hashtag/mention processing
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-3 my-4 italic text-gray-700"
              {...props}
            >
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </blockquote>
          ),
          // Enhanced table styling
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4 border border-gray-200 rounded-lg">
              <table
                className="min-w-full divide-y divide-gray-200"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="px-4 py-3 bg-gray-100 text-left text-sm font-semibold text-gray-700 border-b border-gray-300"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className="px-4 py-3 text-sm text-gray-900 border-b border-gray-100"
              {...props}
            >
              {children}
            </td>
          ),
          // Enhanced heading styling with better hierarchy and hashtag/mention processing
          h1: ({ children, ...props }) => (
            <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-6 border-b border-gray-200 pb-2" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-2xl font-semibold text-gray-900 mb-3 mt-5 border-b border-gray-100 pb-1" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-xl font-medium text-gray-900 mb-2 mt-4" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="text-lg font-medium text-gray-900 mb-2 mt-3" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="text-base font-medium text-gray-900 mb-1 mt-3" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="text-sm font-medium text-gray-700 mb-1 mt-2" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </h6>
          ),
          // Enhanced list styling
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-3 ml-4" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-3 ml-4" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="text-gray-800 leading-relaxed" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </li>
          ),
          // Enhanced paragraph styling with hashtag/mention processing
          p: ({ children, ...props }) => (
            <p className="mb-3 text-gray-800 leading-relaxed" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </p>
          ),
          // Add support for horizontal rules
          hr: ({ ...props }) => (
            <hr className="my-6 border-gray-300" {...props} />
          ),
          // Enhanced emphasis and strong styling with hashtag/mention processing
          em: ({ children, ...props }) => (
            <em className="italic text-gray-800" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </em>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-gray-900" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </strong>
          ),
          // Add support for strikethrough with hashtag/mention processing
          del: ({ children, ...props }) => (
            <del className="line-through text-gray-600" {...props}>
              {React.Children.map(children, (child) => {
                if (typeof child === 'string') {
                  return (
                    <TextRenderer
                      children={child}
                      availableUsers={availableUsers}
                      onHashtagClick={onHashtagClick}
                      onMentionClick={onMentionClick}
                    />
                  );
                }
                return child;
              })}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      </div>

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={closeImageModal}
        src={imageModal.src}
        alt={imageModal.alt}
        title={imageModal.title}
      />
    </>
  );
};

// Backward compatibility - enhanced version of the original component
export const RenderTextWithLinks: React.FC<{
  text: string;
  availableUsers: User[];
  onHashtagClick: (tag: string) => void;
  onMentionClick: (username: string) => void;
  preserveWhitespace?: boolean;
  enableMarkdown?: boolean;
  className?: string;
}> = ({
  text,
  availableUsers,
  onHashtagClick,
  onMentionClick,
  preserveWhitespace = true,
  enableMarkdown = true,
  className = ''
}) => {
  // Check if text contains markdown syntax
  const hasMarkdownSyntax = /[*_`#[\]!]|\n#{1,6}\s|\n\s*[-*+]\s|\n\s*\d+\.\s/.test(text);
  
  if (enableMarkdown && hasMarkdownSyntax) {
    return (
      <MarkdownRenderer
        content={text}
        availableUsers={availableUsers}
        onHashtagClick={onHashtagClick}
        onMentionClick={onMentionClick}
        className={`${preserveWhitespace ? 'whitespace-pre-wrap' : ''} ${className}`}
      />
    );
  }

  // Fallback to original implementation for non-markdown text
  const segments = parseTextWithTagsAndMentions(text, availableUsers);

  return (
    <span className={`${preserveWhitespace ? 'whitespace-pre-wrap' : ''} ${className}`}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case 'hashtag':
            return (
              <button
                key={index}
                onClick={() => onHashtagClick(segment.content)}
                className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors duration-200"
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
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium transition-colors duration-200"
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
