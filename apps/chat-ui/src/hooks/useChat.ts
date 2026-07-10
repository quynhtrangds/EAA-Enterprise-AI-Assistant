import { useState, useEffect } from 'react';
import type { Message } from '../components/chat/MessageBubble';
import { useAuth } from '../contexts/AuthContext';

export interface Session {
  id: string;
  session_code: string;
  title: string;
  updatedAt: string;
}

export const useChat = () => {
  const { authToken, currentUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('session-default');
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch sessions for the current user from database
  const fetchSessions = async (token: string) => {
    try {
      const response = await fetch('/api/chat/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mappedSessions = (data.sessions || []).map((s: any) => {
          let title = s.title || 'Hội thoại mới';
          if (title.length > 25) {
            title = title.substring(0, 25) + '...';
          }
          return {
            id: s.sessionId,
            session_code: s.sessionId,
            title: title,
            updatedAt: s.updatedAt || new Date().toISOString()
          };
        });
        
        if (mappedSessions.length === 0) {
          setSessions([{
            id: 'session-default',
            session_code: 'session-default',
            title: 'Hội thoại mới',
            updatedAt: new Date().toISOString()
          }]);
          setActiveSessionId('session-default');
          setMessages([]);
        } else {
          setSessions(mappedSessions);
          if (activeSessionId !== 'session-default' && !mappedSessions.some((s: any) => s.id === activeSessionId)) {
            setActiveSessionId('session-default');
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  // 2. Fetch messages and traces for the active session from database
  const fetchSessionDetails = async (token: string, sessionCode: string) => {
    if (sessionCode === 'session-default') {
      setMessages([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/sessions/${sessionCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('fetchSessionDetails raw data:', data);
        const mappedMessages = (data.messages || []).map((m: any) => ({
          id: m.id,
          sender: m.role === 'assistant' ? 'ai' : 'user',
          content: m.content,
          timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolCalls: m.toolCalls
        }));
        setMessages(mappedMessages);
      }
    } catch (e) {
      console.error('Failed to fetch session detail:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync session list on current user change
  useEffect(() => {
    if (authToken && currentUser) {
      fetchSessions(authToken);
    } else {
      setSessions([]);
      setMessages([]);
    }
  }, [authToken, currentUser]);

  // Sync messages on active session / token change
  useEffect(() => {
    if (authToken) {
      fetchSessionDetails(authToken, activeSessionId);
    }
  }, [activeSessionId, authToken]);

  const selectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const createNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: Session = {
      id: newId,
      session_code: newId,
      title: 'Hội thoại mới',
      updatedAt: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
  };

  const deleteSession = (id: string) => {
    const nextSessions = sessions.filter(s => s.id !== id);
    setSessions(nextSessions.length > 0 ? nextSessions : [{
      id: 'session-default',
      session_code: 'session-default',
      title: 'Hội thoại mới',
      updatedAt: new Date().toISOString()
    }]);

    if (activeSessionId === id) {
      setActiveSessionId(nextSessions.length > 0 ? nextSessions[0].id : 'session-default');
    }
  };

  const sendMessage = async (content: string) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content,
      timestamp: timeStr
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sessionId: activeSessionId === 'session-default' ? `session-${Date.now()}` : activeSessionId,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối với AI Orchestrator');
      }

      const data = await response.json();
      
      // If we were on 'session-default', switch our active session to the new generated session id
      const targetSessionId = activeSessionId === 'session-default' ? data.sessionId : activeSessionId;
      
      // Reload sessions and select the correct session
      await fetchSessions(authToken!);
      setActiveSessionId(targetSessionId);
      await fetchSessionDetails(authToken!, targetSessionId);
    } catch (error: any) {
      console.error('Lỗi API:', error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        sender: 'ai',
        content: '⚠️ Lỗi: Không thể kết nối tới máy chủ AI Orchestrator. Vui lòng kiểm tra lại trạng thái các service.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage,
    sessions,
    activeSessionId,
    currentUser,
    selectSession,
    createNewSession,
    deleteSession
  };
};
