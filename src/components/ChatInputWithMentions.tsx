import React, { useState, useRef } from 'react';
import { Employee } from '../types';

interface ChatInputWithMentionsProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  employees: Employee[];
  placeholder?: string;
  className?: string;
  listDropDirection?: 'up' | 'down'; // To show suggestions list above or below input
}

export const ChatInputWithMentions: React.FC<ChatInputWithMentionsProps> = ({ 
  value, 
  onChange, 
  onSend, 
  employees, 
  placeholder, 
  className,
  listDropDirection = 'up'
}) => {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);

    const textBeforeCursor = val.substring(0, pos);
    const match = textBeforeCursor.match(/(?:^|\s)(@([^\s]*))$/);

    if (match) {
      setShowMentions(true);
      setMentionQuery(match[2].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const handleSelectMention = (employeeName: string) => {
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)(@([^\s]*))$/);

    if (match) {
      const prefix = textBeforeCursor.substring(0, textBeforeCursor.length - match[1].length);
      const newVal = prefix + '@' + employeeName + ' ' + textAfterCursor;
      onChange(newVal);
      setShowMentions(false);
      inputRef.current?.focus();
    }
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(mentionQuery));

  return (
    <div className="relative flex-1 flex flex-col font-sans h-full w-full">
      {showMentions && filteredEmployees.length > 0 && (
        <div className={`absolute ${listDropDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0 w-64 bg-card text-foreground border border-border rounded-2xl shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2`}>
          <div className="max-h-48 overflow-y-auto no-scrollbar py-2" dir="rtl">
            {filteredEmployees.map(emp => (
              <button
                key={emp.id}
                type="button"
                className="w-full flex items-center text-right px-4 py-3 hover:bg-muted text-foreground border-b border-border/50 last:border-0 transition"
                onClick={() => handleSelectMention(emp.name)}
              >
                <div className="flex justify-between items-center w-full gap-2">
                  <span className="font-bold text-sm truncate">{emp.name}</span>
                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">{emp.employeeId}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <input 
        ref={inputRef}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={handleInput}
        onClick={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
        onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (showMentions && filteredEmployees.length > 0) {
              e.preventDefault();
              handleSelectMention(filteredEmployees[0].name);
            } else {
              e.preventDefault();
              onSend();
            }
          } else if (e.key === 'Escape') {
            setShowMentions(false);
          }
        }}
      />
    </div>
  );
};
