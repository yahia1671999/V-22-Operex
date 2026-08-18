import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, MessageCircle, ExternalLink, ChevronRight } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../AuthContext';
import { TaskChatMessage } from '../types';
import { db, doc, updateDoc, arrayUnion } from '../api';
import { ChatInputWithMentions } from './ChatInputWithMentions';
import { getTaskAssignedIds } from '../lib/taskUtils';

interface Conversation {
  id: string;
  type: 'project' | 'task';
  title: string;
  messages: TaskChatMessage[];
  unreadCount: number;
  lastMessageAt: number;
}

export const ChatHeads: React.FC = () => {
  const { projects, projectTasks, employees } = useData();
  const { user, profile } = useAuth();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [seenMessagesCount, setSeenMessagesCount] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('chatHeadsSeen');
      return stored ? JSON.parse(stored) : {};
    } catch(e) { return {}; }
  });

  const myEmpId = (profile as any)?.employeeId || profile?.id;
  const myUserId = user?.email; // Use email as UID in our SQL system

  // 1. Compile conversations
  let allConvos: Conversation[] = [];
  
  projects.forEach(p => {
    if (p.chat && p.chat.length > 0) {
      const isParticipant = p.chat.some(m => m.userId === myUserId);
      const isMentioned = p.chat.some(m => m.mentions?.includes(myEmpId));
      const isRelated = p.projectManagerId === myEmpId || p.teamLeaderId === myEmpId || p.consultantTlId === myEmpId || p.developerTlId === myEmpId;
      
      if (isParticipant || isMentioned || isRelated) {
        allConvos.push({
          id: p.id,
          type: 'project',
          title: p.name,
          messages: p.chat,
          unreadCount: 0,
          lastMessageAt: new Date(p.chat[p.chat.length - 1].createdAt).getTime()
        });
      }
    }
  });

  projectTasks.forEach(t => {
    if (t.comments && t.comments.length > 0) {
      const isParticipant = t.comments.some(m => m.userId === myUserId);
      const isMentioned = t.comments.some(m => m.mentions?.includes(myEmpId));
      const isRelated = t.creatorId === myEmpId || getTaskAssignedIds(t).includes(myEmpId);

      if (isParticipant || isMentioned || isRelated) {
        allConvos.push({
          id: t.id,
          type: 'task',
          title: t.title,
          messages: t.comments,
          unreadCount: 0,
          lastMessageAt: new Date(t.comments[t.comments.length - 1].createdAt).getTime()
        });
      }
    }
  });

  // Sort by last message desc
  allConvos.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

  // Apply seen counts calculation
  allConvos = allConvos.map(c => {
    const seen = seenMessagesCount[c.id] || 0;
    const unread = Math.max(0, c.messages.length - seen);
    return { ...c, unreadCount: unread };
  });

  const totalUnread = allConvos.reduce((sum, c) => sum + c.unreadCount, 0);
  const activeConversation = allConvos.find(c => c.id === activeConversationId);

  // Update seen count for active conversation when messages change
  useEffect(() => {
    if (activeConversation) {
      setSeenMessagesCount(prev => {
        const newCount = { ...prev, [activeConversation.id]: activeConversation.messages.length };
        localStorage.setItem('chatHeadsSeen', JSON.stringify(newCount));
        return newCount;
      });
    }
  }, [activeConversation?.messages.length, activeConversation?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (activeConversationId) {
      scrollToBottom();
    }
  }, [activeConversationId, activeConversation?.messages.length]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !activeConversation || !user) return;

    // Simple mention detection
    const mentions = employees
      .filter(e => inputValue.includes(`@${e.name}`))
      .map(e => e.id);

    const newMessage: TaskChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      userId: myUserId || '',
      userName: (profile as any)?.name || user.email || 'مستخدم',
      text: inputValue.trim(),
      mentions,
      createdAt: new Date().toISOString()
    };

    setInputValue('');
    scrollToBottom();

    try {
      if (activeConversation.type === 'project') {
        const ref = doc(db, 'projects', activeConversation.id);
        await updateDoc(ref, { chat: arrayUnion(newMessage) });
      } else {
        const ref = doc(db, 'projectTasks', activeConversation.id);
        await updateDoc(ref, { comments: arrayUnion(newMessage) });
      }
    } catch (e) {
      console.error(e);
      alert('حدث خطأ في الإرسال');
    }
  };

  const handleNavigateToEntity = () => {
    if (!activeConversation) return;
    
    // Dispatch event to Layout
    window.dispatchEvent(new CustomEvent('navigate_to_entity', {
      detail: {
        module: 'operations',
        tab: 'operations', // Both projects and tasks are under operations usually
        entityId: activeConversation.id,
        type: activeConversation.type
      }
    }));
    
    setActiveConversationId(null);
    setIsMenuOpen(false);
  };

  if (!user) return null;

  return (
    <>
      <div className="fixed inset-0 pointer-events-none z-[100]" ref={containerRef}>
        <motion.div 
          drag
          dragConstraints={containerRef}
          dragElastic={0.1}
          dragMomentum={false}
          className="absolute bottom-24 right-4 sm:right-6 pointer-events-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <div className="relative group">
            <motion.button
              onClick={() => {
                if (activeConversationId) {
                  setActiveConversationId(null);
                  setIsMenuOpen(true);
                } else {
                  setIsMenuOpen(!isMenuOpen);
                }
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full bg-white/80 backdrop-blur-xl shadow-xl border border-white flex items-center justify-center overflow-hidden transition-shadow hover:shadow-2xl hover:shadow-blue-500/20"
            >
              <div className="bg-gradient-to-tr from-[#0084FF] to-[#00B2FF] w-full h-full flex items-center justify-center text-white">
                 <MessageCircle className="w-8 h-8 fill-white/20" />
              </div>
            </motion.button>
            
            {totalUnread > 0 && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shadow border-2 border-white pointer-events-none"
              >
                {totalUnread > 9 ? '+9' : totalUnread}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Conversations Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && !activeConversationId && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-44 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 h-[400px] max-h-[60vh] z-[105] bg-card dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl rounded-3xl border border-border flex flex-col overflow-hidden text-foreground"
            dir="rtl"
          >
            <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">المحادثات</h3>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {allConvos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mb-2 opacity-20" />
                  <p className="font-medium">لا توجد محادثات نشطة</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {allConvos.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => setActiveConversationId(convo.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-2xl transition-colors text-right relative group"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center font-bold text-primary shrink-0">
                        {convo.title.substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-foreground text-sm truncate">{convo.title}</h4>
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {new Date(convo.lastMessageAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute:'2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {convo.messages[convo.messages.length - 1]?.text}
                        </p>
                      </div>
                      {convo.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-[#0084FF] rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {convo.unreadCount}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay: Chat Window */}
      <AnimatePresence>
        {activeConversation && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-44 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-80 md:w-96 h-[500px] max-h-[70vh] z-[110] bg-card dark:bg-slate-900/95 backdrop-blur-3xl shadow-2xl rounded-[1.5rem] border border-border flex flex-col overflow-hidden text-foreground"
            dir="rtl"
          >
            {/* Header */}
            <div className="h-16 px-4 bg-muted/30 backdrop-blur-md border-b border-border flex items-center justify-between shrink-0 shadow-sm relative z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveConversationId(null)} 
                  className="p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0084FF] to-[#00B2FF] flex items-center justify-center text-white font-bold shadow-sm text-sm">
                    {activeConversation.title.substring(0,2)}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#31A24C] border-2 border-background rounded-full"></div>
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm truncate max-w-[120px]">{activeConversation.title}</h3>
                  <p className="text-[10px] text-[#31A24C] font-medium">متصل الآن ({activeConversation.type === 'project' ? 'مشروع' : 'مهمة'})</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={handleNavigateToEntity}
                  title="الذهاب للعملية"
                  className="p-2 hover:bg-muted rounded-full text-[#0084FF] transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </button>
                <button onClick={() => { setActiveConversationId(null); setIsMenuOpen(false); }} className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar bg-background/50">
              {activeConversation.messages.map((msg, idx) => {
                const isMe = msg.userId === user?.uid;
                const showAvatar = !isMe && (idx === 0 || activeConversation.messages[idx - 1].userId !== msg.userId);

                return (
                  <div key={msg.id} className={`flex gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    {/* Optional small avatar for others */}
                    {!isMe ? (
                      <div className="w-6 shrink-0 flex flex-col justify-end">
                         {showAvatar && (
                           <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold mb-4 shadow-sm">
                             {msg.userName.substring(0,1)}
                           </div>
                         )}
                      </div>
                    ) : null}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {showAvatar && !isMe && <span className="text-[10px] text-muted-foreground mb-1 ml-2 font-medium">{msg.userName}</span>}
                      <div className={`px-4 py-2.5 text-[15px] font-medium shadow-sm ${
                        isMe 
                          ? 'bg-[#0084FF] text-white rounded-[1.2rem] rounded-br-sm' 
                          : 'bg-muted text-foreground border border-border rounded-[1.2rem] rounded-bl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-muted-foreground mt-1 px-1 font-medium">
                        {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Input Footer */}
            <div className="p-3 bg-card border-t border-border shrink-0 relative z-[120]">
              <div className="flex items-center gap-2 bg-muted/60 rounded-[1.5rem] pl-2 pr-4 border border-border">
                <ChatInputWithMentions
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSendMessage}
                  employees={employees}
                  placeholder="اكتب رسالة... @ لمنشن"
                  listDropDirection="up"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-2.5 outline-none text-foreground font-medium placeholder:text-muted-foreground w-full"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="p-1.5 text-[#0084FF] disabled:text-muted-foreground transition-colors flex shrink-0 items-center justify-center hover:scale-110 active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.15);
          border-radius: 10px;
        }
      `}</style>
    </>
  );
};

