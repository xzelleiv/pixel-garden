import React from 'react';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface LogPanelProps {
  logs: string[];
  maxLogs?: number;
  typingSpeed?: number;
  compact?: boolean;
}

const getClampStyles = (lineClamp: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lineClamp,
});

const LogMessage: React.FC<{
  text: string;
  isTyping: boolean;
  className?: string;
  typingSpeed: number;
  clampLines: number;
  showCursor: boolean;
}> = ({ text, isTyping, className, typingSpeed, clampLines, showCursor }) => {
  const displayedText = useTypingEffect(text, typingSpeed);
  const content = isTyping ? displayedText : text;

  return (
    <p
      style={getClampStyles(clampLines)}
      className={`text-pixel-console-text ${clampLines === 2 ? 'text-[10px]' : 'text-[11px]'} leading-tight whitespace-pre-wrap break-words ${className || ''}`}
    >
      <span className="text-pixel-accent mr-2">{'>'}</span>
      {content}
      {isTyping && showCursor && <span className="animate-pulse bg-pixel-console-text w-2 h-4 inline-block ml-1"></span>}
    </p>
  );
};

const LogPanel: React.FC<LogPanelProps> = ({ logs, maxLogs = 6, typingSpeed = 20, compact = false }) => {
  const effectiveMaxLogs = compact ? Math.max(maxLogs, 8) : maxLogs;
  const clampLines = compact ? 2 : 3;
  const visibleLogs = logs.slice(-effectiveMaxLogs);
  const mobileHeightClass = compact ? 'min-h-[3.25rem] max-h-[3.25rem]' : 'min-h-[4.25rem] max-h-[4.25rem]';

  return (
    <div className={`log-panel-root font-press-start w-full max-w-7xl bg-pixel-console-bg border-2 border-pixel-border shadow-pixel p-2 lg:p-4 ${mobileHeightClass} md:min-h-[6rem] lg:h-40 mb-2 sm:mb-4 flex flex-col justify-end gap-1 overflow-hidden`}>
      {visibleLogs.map((log, index) => {
        const isOlderLog = index < visibleLogs.length - 2;
        return (
          <LogMessage
            key={`${log}-${index}`}
            text={log}
            isTyping={index === visibleLogs.length - 1}
            className={isOlderLog ? 'hidden md:block' : ''}
            typingSpeed={typingSpeed}
            clampLines={clampLines}
            showCursor={typingSpeed > 0}
          />
        );
      })}
    </div>
  );
};

export default LogPanel;