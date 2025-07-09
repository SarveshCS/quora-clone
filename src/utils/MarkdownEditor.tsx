import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MarkdownRenderer } from './markdownRenderer';
import { type User } from './textUtils';
import MentionDropdown from '../components/MentionDropdown';
import { 
  FiEye, FiEdit3, FiImage, FiLink, FiBold, FiItalic, FiCode, 
  FiList, FiHash, FiMessageSquare, FiMinus, FiRotateCcw, FiRotateCw, FiType
} from 'react-icons/fi';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableUsers: User[];
  onHashtagClick: (tag: string) => void;
  onMentionClick: (username: string) => void;
  minHeight?: string;
  maxHeight?: string;
  showPreview?: boolean;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Write your content here... You can use **bold**, *italic*, `code`, [links](url), ![images](url), #hashtags, @mentions, and more!",
  availableUsers,
  onHashtagClick,
  onMentionClick,
  minHeight = "300px",
  maxHeight = "600px",
  showPreview = true,
  className = ""
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  const [currentHeight, setCurrentHeight] = useState(parseInt(minHeight));
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement | null>(null);
  
  // Mention dropdown state
  const [mentionDropdown, setMentionDropdown] = useState({
    isVisible: false,
    searchTerm: '',
    position: { top: 0, left: 0 },
    startIndex: 0
  });
  
  // Undo/Redo history management
  const [history, setHistory] = useState<string[]>([value || ""]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save to history when value changes (with debouncing)
  useEffect(() => {
    if (historyTimeoutRef.current) {
      clearTimeout(historyTimeoutRef.current);
    }
    
    historyTimeoutRef.current = setTimeout(() => {
      if (value !== history[historyIndex]) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(value);
        
        // Limit history to 100 entries
        if (newHistory.length > 100) {
          newHistory.shift();
        } else {
          setHistoryIndex(historyIndex + 1);
        }
        
        setHistory(newHistory);
      }
    }, 500); // 500ms debounce

    return () => {
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [value, history, historyIndex]);

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onChange(history[newIndex]);
    }
  }, [historyIndex, history, onChange]);

  // Memoize the preview to avoid unnecessary re-renders
  const previewContent = useMemo(() => {
    if (!value.trim()) return null;
    return (
      <MarkdownRenderer
        content={value}
        availableUsers={availableUsers}
        onHashtagClick={onHashtagClick}
        onMentionClick={onMentionClick}
        className="min-h-full"
      />
    );
  }, [value, availableUsers, onHashtagClick, onMentionClick]);

  // Detect @ mentions as user types
  const detectMention = useCallback((text: string, cursorPosition: number) => {
    if (!textareaRef) return;

    // Find the last @ before cursor position
    const beforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = beforeCursor.lastIndexOf('@');
    
    if (lastAtIndex === -1) {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
      return;
    }

    // Check if there's a space or newline between @ and cursor (which would break the mention)
    const textAfterAt = beforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
      return;
    }

    // Check if @ is at start of text or preceded by whitespace
    const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' ';
    if (charBeforeAt !== ' ' && charBeforeAt !== '\n' && lastAtIndex !== 0) {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
      return;
    }

    // Calculate dropdown position more accurately
    const rect = textareaRef.getBoundingClientRect();
    const textStyle = window.getComputedStyle(textareaRef);
    const lineHeight = parseInt(textStyle.lineHeight) || 20;
    const fontSize = parseInt(textStyle.fontSize) || 14;
    const paddingLeft = parseInt(textStyle.paddingLeft) || 16;
    const paddingTop = parseInt(textStyle.paddingTop) || 16;
    
    // Split text into lines to calculate position
    const textLines = beforeCursor.split('\n');
    const currentLineIndex = textLines.length - 1;
    const currentLineText = textLines[currentLineIndex];
    
    // Estimate character width (approximate for monospace)
    const charWidth = fontSize * 0.6;
    
    // Calculate position
    const lineOffset = currentLineIndex * lineHeight;
    const charOffset = currentLineText.length * charWidth;
    
    // Account for textarea scroll position
    const scrollTop = textareaRef.scrollTop;
    const scrollLeft = textareaRef.scrollLeft;
    
    const dropdownPosition = {
      top: rect.top + paddingTop + lineOffset - scrollTop + lineHeight + 5,
      left: Math.min(
        rect.left + paddingLeft + charOffset - scrollLeft,
        window.innerWidth - 320 // Ensure dropdown doesn't go off-screen
      )
    };

    // Show dropdown with search term
    setMentionDropdown({
      isVisible: true,
      searchTerm: textAfterAt,
      position: dropdownPosition,
      startIndex: lastAtIndex
    });
  }, [textareaRef]);

  // Handle user selection from mention dropdown
  const handleUserSelect = useCallback((user: User) => {
    if (!textareaRef || !mentionDropdown.isVisible) return;

    const beforeMention = value.substring(0, mentionDropdown.startIndex);
    const afterCursor = value.substring(textareaRef.selectionStart);
    const newText = beforeMention + `@${user.username} ` + afterCursor;
    
    onChange(newText);
    
    // Close dropdown
    setMentionDropdown(prev => ({ ...prev, isVisible: false }));
    
    // Set cursor position after the mention
    setTimeout(() => {
      const newCursorPos = beforeMention.length + user.username.length + 2; // +2 for "@" and " "
      textareaRef.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef, mentionDropdown]);

  // Close dropdown on textarea scroll
  useEffect(() => {
    const handleScroll = () => {
      if (mentionDropdown.isVisible) {
        setMentionDropdown(prev => ({ ...prev, isVisible: false }));
      }
    };

    if (textareaRef && mentionDropdown.isVisible) {
      textareaRef.addEventListener('scroll', handleScroll);
      return () => textareaRef.removeEventListener('scroll', handleScroll);
    }
  }, [textareaRef, mentionDropdown.isVisible]);

  // Handle manual resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    // Add resizing class to prevent text selection
    document.body.classList.add('markdown-editor-resizing');
    
    const startY = e.clientY;
    const startHeight = currentHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.min(
        Math.max(startHeight + deltaY, parseInt(minHeight)),
        parseInt(maxHeight)
      );
      setCurrentHeight(newHeight);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('markdown-editor-resizing');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [currentHeight, minHeight, maxHeight]);

  // Handle input changes with mention detection (without auto-resize)
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    onChange(newValue);
    
    // Detect mentions
    setTimeout(() => {
      detectMention(newValue, cursorPosition);
    }, 0);
  }, [onChange, detectMention]);

  // Handle textarea focus/blur events
  const handleTextareaBlur = useCallback(() => {
    // Close mention dropdown when textarea loses focus
    // Use timeout to allow dropdown clicks to register first
    setTimeout(() => {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
    }, 150);
  }, []);

  const handleTextareaFocus = useCallback(() => {
    // Re-detect mention if there was one when focus returns
    if (textareaRef) {
      const cursorPosition = textareaRef.selectionStart;
      detectMention(value, cursorPosition);
    }
  }, [textareaRef, value, detectMention]);

  // Handle cursor position changes (selection changes)
  const handleSelectionChange = useCallback(() => {
    if (!textareaRef) return;
    
    const cursorPosition = textareaRef.selectionStart;
    const endPosition = textareaRef.selectionEnd;
    
    // If user made a selection (not just cursor movement), close dropdown
    if (cursorPosition !== endPosition) {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
      return;
    }
    
    // Re-detect mention at new cursor position
    detectMention(value, cursorPosition);
  }, [textareaRef, value, detectMention]);

  // Helper function to insert or wrap text at cursor position
  const insertText = useCallback((before: string, after: string = '', placeholder: string = '') => {
    if (!textareaRef) return;

    const startPos = textareaRef.selectionStart;
    const endPos = textareaRef.selectionEnd;
    const selectedText = value.substring(startPos, endPos);
    
    let newText: string;
    let newCursorStart: number;
    let newCursorEnd: number;

    if (selectedText) {
      // If text is selected, wrap it with markdown syntax
      newText = value.substring(0, startPos) + before + selectedText + after + value.substring(endPos);
      newCursorStart = startPos + before.length;
      newCursorEnd = startPos + before.length + selectedText.length;
    } else {
      // If no text selected, insert template text
      const insertText = before + placeholder + after;
      newText = value.substring(0, startPos) + insertText + value.substring(endPos);
      
      if (placeholder) {
        // Select the placeholder text
        newCursorStart = startPos + before.length;
        newCursorEnd = startPos + before.length + placeholder.length;
      } else {
        // Place cursor at the end
        newCursorStart = startPos + insertText.length;
        newCursorEnd = startPos + insertText.length;
      }
    }
    
    onChange(newText);

    // Set cursor position after insertion
    setTimeout(() => {
      textareaRef.setSelectionRange(newCursorStart, newCursorEnd);
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef]);

  // Helper for simple insertions without wrapping (for cases where we just insert at cursor)
  const insertSimpleText = useCallback((textToInsert: string) => {
    if (!textareaRef) return;

    const startPos = textareaRef.selectionStart;
    const endPos = textareaRef.selectionEnd;
    const newText = value.substring(0, startPos) + textToInsert + value.substring(endPos);
    
    onChange(newText);

    // Set cursor position after insertion
    setTimeout(() => {
      textareaRef.setSelectionRange(startPos + textToInsert.length, startPos + textToInsert.length);
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef]);

  // Smart heading function that handles multiple heading levels
  const handleHeading = useCallback(() => {
    if (!textareaRef) return;

    const startPos = textareaRef.selectionStart;
    const endPos = textareaRef.selectionEnd;
    const selectedText = value.substring(startPos, endPos);
    
    // Find the start of the current line
    const beforeCursor = value.substring(0, startPos);
    const lineStartIndex = beforeCursor.lastIndexOf('\n') + 1;
    const lineBeforeSelection = value.substring(lineStartIndex, startPos);
    
    // Check if there are already hash symbols at the beginning of the line
    const existingHashes = lineBeforeSelection.match(/^(#+)\s*/);
    
    let newText: string;
    let newCursorStart: number;
    let newCursorEnd: number;
    
    if (existingHashes) {
      // If there are already hashes, add one more (up to 6 levels)
      const currentHashes = existingHashes[1];
      if (currentHashes.length < 6) {
        const newHashes = currentHashes + '#';
        const replacement = newHashes + ' ';
        newText = value.substring(0, lineStartIndex) + 
                 replacement + 
                 value.substring(lineStartIndex + existingHashes[0].length);
        
        // Adjust cursor position
        const hashDifference = 1; // We added one hash
        newCursorStart = startPos + hashDifference;
        newCursorEnd = endPos + hashDifference;
      } else {
        // If already at max level (6), remove all hashes
        newText = value.substring(0, lineStartIndex) + 
                 value.substring(lineStartIndex + existingHashes[0].length);
        
        // Adjust cursor position
        const removedLength = existingHashes[0].length;
        newCursorStart = Math.max(lineStartIndex, startPos - removedLength);
        newCursorEnd = Math.max(lineStartIndex, endPos - removedLength);
      }
    } else {
      // No existing hashes, add H1
      if (selectedText) {
        // If text is selected, wrap it with heading syntax
        newText = value.substring(0, lineStartIndex) + 
                 '# ' + 
                 value.substring(lineStartIndex, startPos) + 
                 selectedText + 
                 value.substring(endPos);
        newCursorStart = startPos + 2; // Account for "# "
        newCursorEnd = endPos + 2;
      } else {
        // If no text selected, insert template
        const insertionText = '# Heading';
        newText = value.substring(0, lineStartIndex) + 
                 insertionText + 
                 value.substring(lineStartIndex);
        
        // Select the "Heading" part
        newCursorStart = lineStartIndex + 2; // After "# "
        newCursorEnd = lineStartIndex + insertionText.length;
      }
    }
    
    onChange(newText);

    // Set cursor position after insertion
    setTimeout(() => {
      textareaRef.setSelectionRange(newCursorStart, newCursorEnd);
      textareaRef.focus();
    }, 0);
  }, [value, onChange, textareaRef]);

  // Toolbar button actions - each uses proper parameters for insertText
  const toolbarActions = {
    // Text formatting - wraps selected text or inserts template
    bold: () => insertText('**', '**', 'bold text'),
    italic: () => insertText('*', '*', 'italic text'),
    code: () => insertText('`', '`', 'code'),
    strikethrough: () => insertText('~~', '~~', 'strikethrough text'),
    
    // Links and media - complex structures that need templates
    link: () => insertText('[', '](url)', 'link text'),
    image: () => insertText('![', '](image-url)', 'alt text'),
    
    // Block-level elements - can wrap selected text or insert template
    codeBlock: () => insertSimpleText('\n```\ncode block\n```\n'),
    list: () => insertText('- ', '', 'List item'),
    orderedList: () => insertText('1. ', '', 'Numbered item'),
    heading: handleHeading, // Use the smart heading function
    quote: () => insertText('> ', '', 'Quote'),
    divider: () => insertSimpleText('\n---\n'),
    
    // Social elements - always insert at cursor
    hashtag: () => insertSimpleText('#hashtag '),
    mention: () => insertSimpleText('@username ')
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // If mention dropdown is visible, let it handle certain keys
    if (mentionDropdown.isVisible) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        // These keys are handled by the MentionDropdown component
        return;
      }
    }

    // Handle tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      insertSimpleText('  ');
    }
    
    // Handle Ctrl/Cmd + shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            redo(); // Ctrl+Shift+Z for redo
          } else {
            undo(); // Ctrl+Z for undo
          }
          break;
        case 'y':
          e.preventDefault();
          redo(); // Ctrl+Y for redo
          break;
        case 'b':
          e.preventDefault();
          toolbarActions.bold();
          break;
        case 'i':
          e.preventDefault();
          toolbarActions.italic();
          break;
        case 'k':
          e.preventDefault();
          toolbarActions.link();
          break;
        case '`':
          e.preventDefault();
          toolbarActions.code();
          break;
      }
    }
    
    // Close mention dropdown on certain keys
    if (mentionDropdown.isVisible && ['Space', 'Enter', 'Tab'].includes(e.code)) {
      setMentionDropdown(prev => ({ ...prev, isVisible: false }));
    }
  };

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 px-2 sm:px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-thin">
            {/* Undo/Redo */}
            <button
              type="button"
              onClick={undo}
              disabled={historyIndex === 0}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Undo (Ctrl+Z)"
            >
              <FiRotateCcw size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={historyIndex === history.length - 1}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Redo (Ctrl+Y)"
            >
              <FiRotateCw size={14} className="sm:w-4 sm:h-4" />
            </button>
            
            <div className="w-px h-3 sm:h-4 bg-gray-300 mx-1 sm:mx-2 flex-shrink-0" />
            
            {/* Text formatting */}
            <button
              type="button"
              onClick={toolbarActions.bold}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Bold (Ctrl+B)"
            >
              <FiBold size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.italic}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Italic (Ctrl+I)"
            >
              <FiItalic size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.code}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Inline Code (Ctrl+`)"
            >
              <FiCode size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.strikethrough}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Strikethrough"
            >
              <FiType size={14} className="sm:w-4 sm:h-4" />
            </button>
            
            <div className="w-px h-3 sm:h-4 bg-gray-300 mx-1 sm:mx-2 flex-shrink-0" />
            
            {/* Links and media */}
            <button
              type="button"
              onClick={toolbarActions.link}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Link (Ctrl+K)"
            >
              <FiLink size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.image}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Image"
            >
              <FiImage size={14} className="sm:w-4 sm:h-4" />
            </button>
            
            <div className="w-px h-3 sm:h-4 bg-gray-300 mx-1 sm:mx-2 flex-shrink-0" />
            
            {/* Structure */}
            <button
              type="button"
              onClick={toolbarActions.heading}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Heading"
            >
              <FiHash size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.list}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Bulleted List"
            >
              <FiList size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.orderedList}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Numbered List"
            >
              <span className="text-xs sm:text-sm font-mono">1.</span>
            </button>
            
            <div className="w-px h-3 sm:h-4 bg-gray-300 mx-1 sm:mx-2 flex-shrink-0" />
            
            {/* Quote and divider */}
            <button
              type="button"
              onClick={toolbarActions.quote}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Quote"
            >
              <FiMessageSquare size={14} className="sm:w-4 sm:h-4" />
            </button>
            <button
              type="button"
              onClick={toolbarActions.divider}
              className="p-1.5 sm:p-1 rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Horizontal Rule"
            >
              <FiMinus size={14} className="sm:w-4 sm:h-4" />
            </button>
          </div>
          
          {/* Preview toggle */}
          {showPreview && (
            <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs sm:text-sm transition-colors ${
                  isPreviewMode 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isPreviewMode ? (
                  <>
                    <FiEdit3 size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </>
                ) : (
                  <>
                    <FiEye size={12} className="sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">Preview</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor/Preview area */}
      <div 
        className="relative flex-1"
        style={{ height: `${currentHeight}px` }}
      >
        {isPreviewMode ? (
          <div 
            className="p-4 overflow-y-auto markdown-preview h-full" 
            style={{ height: `${currentHeight}px` }}
          >
            {previewContent || (
              <div className="text-gray-500 italic">
                Nothing to preview yet. Start typing to see the markdown rendered!
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-full">
            <textarea
              ref={setTextareaRef}
              value={value}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onBlur={handleTextareaBlur}
              onFocus={handleTextareaFocus}
              onSelect={handleSelectionChange}
              onMouseUp={handleSelectionChange} // For mouse-based cursor movements
              onKeyUp={handleSelectionChange} // For keyboard-based cursor movements
              placeholder={placeholder}
              className="w-full h-full p-4 border-none outline-none resize-none font-mono text-sm leading-relaxed overflow-y-auto"
              style={{ height: `${currentHeight}px` }}
            />
          </div>
        )}
        
        {/* Resize handle */}
        <div
          ref={resizeRef}
          className={`markdown-editor-resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleMouseDown}
          title="Drag to resize editor height"
        />
      </div>

      {/* Helper text */}
      <div className="bg-gray-50 border-t border-gray-200 px-2 sm:px-3 py-2 text-xs text-gray-600">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="font-medium">Supports markdown:</span>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <span className="font-mono bg-gray-100 px-1 rounded">**bold**</span>
              <span className="font-mono bg-gray-100 px-1 rounded">*italic*</span>
              <span className="font-mono bg-gray-100 px-1 rounded">`code`</span>
              <span className="font-mono bg-gray-100 px-1 rounded">[links](url)</span>
              <span className="font-mono bg-gray-100 px-1 rounded">#hashtags</span>
              <span className="font-mono bg-gray-100 px-1 rounded">@mentions</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span>Height: {currentHeight}px</span>
            <span className="hidden sm:inline">•</span>
            <span className="hidden sm:inline">Range: {minHeight} - {maxHeight}</span>
          </div>
        </div>
      </div>

      {/* Mention Dropdown */}
      <MentionDropdown
        users={availableUsers}
        searchTerm={mentionDropdown.searchTerm}
        position={mentionDropdown.position}
        onUserSelect={handleUserSelect}
        onClose={() => setMentionDropdown(prev => ({ ...prev, isVisible: false }))}
        isVisible={mentionDropdown.isVisible}
      />
    </div>
  );
};

export default MarkdownEditor;
