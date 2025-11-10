
import React from 'react';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface LogPanelProps {
  logs: string[];
  maxLogs?: number;
}

const LogMessage: React.FC<{ text: string; isTyping: boolean, className?: string }> = ({ text, isTyping, className }) => {
  const displayedText = useTypingEffect(text, 20);
  const content = isTyping ? displayedText : text;
  
  return (
    <p className={`text-pixel-console-text ${className || ''}`}>
      <span className="text-pixel-accent mr-2">{'>'}</span>
      {content}
      {isTyping && <span className="animate-pulse bg-pixel-console-text w-2 h-4 inline-block ml-1"></span>}
    </p>
  );
};

const LogPanel: React.FC<LogPanelProps> = ({ logs, maxLogs = 6 }) => {
  const visibleLogs = logs.slice(-maxLogs);

  return (
    <div className="font-press-start w-full max-w-7xl bg-pixel-console-bg border-2 border-pixel-border shadow-pixel p-2 lg:p-4 h-20 sm:h-24 lg:h-40 mb-2 sm:mb-4 flex flex-col justify-end overflow-hidden">
      {visibleLogs.map((log, index) => {
        const isHiddenOnMobile = visibleLogs.length > 2 && index < visibleLogs.length - 2;
        return (
            <LogMessage 
                key={index} 
                text={log} 
                isTyping={index === visibleLogs.length - 1} 
                className={isHiddenOnMobile ? 'hidden lg:block' : ''}
            />
        );
      })}
    </div>
  );
};

export default LogPanel;