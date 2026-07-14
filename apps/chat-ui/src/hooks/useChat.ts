import { useState, useEffect } from 'react';
import type { Message } from '../components/chat/MessageBubble';
import { useAuth } from '../contexts/AuthContext';

const formatTimestamp = (dateInput?: string) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart} at ${timePart}`;
};

export interface Session {
  isStarred: boolean;
  id: string;
  session_code: string;
  title: string;
  updatedAt: string;
}

export interface SearchSession extends Session {
  matchedMessage?: string;
}

export const useChat = () => {
  const { authToken, currentUser } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('new-chat-session');
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
        console.log('fetchSessions raw data:', data);
        const mappedSessions = (data.sessions || []).map((s: any) => {
          let title = s.title || 'Hội thoại mới';
          if (title.length > 25) {
            title = title.substring(0, 25) + '...';
          }
          console.log('Mapping session s.updatedAt:', s.updatedAt, 'parsed:', new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          return {
            id: s.sessionId,
            session_code: s.sessionId,
            title: title,
            updatedAt: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStarred: s.isStarred || false
          };
        });

        if (mappedSessions.length === 0) {
          setSessions([{
            id: 'new-chat-session',
            session_code: 'new-chat-session',
            title: 'Hội thoại mới',
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStarred: false
          }]);
          setActiveSessionId('new-chat-session');
          setMessages([]);
        } else {
          setSessions(mappedSessions);
          if (activeSessionId !== 'new-chat-session' && !mappedSessions.some((s: any) => s.id === activeSessionId)) {
            setActiveSessionId('new-chat-session');
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  // 2. Search sessions across titles and contents
  const searchSessionsApi = async (query: string): Promise<SearchSession[]> => {
    if (!authToken || !query.trim()) return [];
    try {
      const response = await fetch(`/api/chat/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        return (data.sessions || []).map((s: any) => ({
          id: s.sessionId,
          session_code: s.sessionId,
          title: s.title || 'Hội thoại mới',
          updatedAt: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          isStarred: s.isStarred || false,
          matchedMessage: s.matchedMessage
        }));
      }
    } catch (e) {
      console.error('Failed to search sessions:', e);
    }
    return [];
  };

  // 3. Fetch messages and traces for the active session from database
  const fetchSessionDetails = async (token: string, sessionCode: string) => {
    if (sessionCode === 'new-chat-session') {
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
          timestamp: formatTimestamp(m.createdAt),
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
      setActiveSessionId('new-chat-session');
      setMessages([]);
    } else {
      setSessions([]);
      setMessages([]);
      setActiveSessionId('new-chat-session');
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
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStarred: false
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setMessages([]);
  };

  const deleteSession = async (id: string) => {
    // Optimistic update
    const nextSessions = sessions.filter(s => s.id !== id);
    setSessions(nextSessions.length > 0 ? nextSessions : [{
      id: 'new-chat-session',
      session_code: 'new-chat-session',
      title: 'Hội thoại mới',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStarred: false
    }]);

    if (activeSessionId === id) {
      setActiveSessionId('new-chat-session');
    }

    // Call API
    if (authToken) {
      try {
        const response = await fetch(`/api/chat/sessions/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
          console.error('Failed to delete session on server');
        }
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    const timeStr = formatTimestamp();

    // Find where to truncate
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    // Truncate local state and append the edited message
    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content,
      timestamp: timeStr
    };

    setMessages(prev => [...prev.slice(0, index), newUserMsg]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          sessionId: activeSessionId === 'new-chat-session' ? `session-${Date.now()}` : activeSessionId,
          messageId,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối với AI Orchestrator');
      }

      await fetchSessions(authToken!);
      await fetchSessionDetails(authToken!, activeSessionId);
    } catch (error: any) {
      console.error('Lỗi API:', error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        sender: 'ai',
        content: '⚠️ Lỗi: Không thể kết nối tới máy chủ AI Orchestrator. Vui lòng kiểm tra lại trạng thái các service.',
        timestamp: formatTimestamp()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    const timeStr = formatTimestamp();
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
          sessionId: activeSessionId === 'new-chat-session' ? `session-${Date.now()}` : activeSessionId,
          message: content
        })
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối với AI Orchestrator');
      }

      const data = await response.json();

      // If we were on 'new-chat-session', switch our active session to the new generated session id
      const targetSessionId = activeSessionId === 'new-chat-session' ? data.sessionId : activeSessionId;

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
        timestamp: formatTimestamp()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renameSessionApi = async (sessionId: string, newTitle: string) => {
    console.log('renameSessionApi called with:', { sessionId, newTitle, authToken });
    if (!authToken) return;

    // Optimistic update
    setSessions(prev => {
      const next = prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s);
      console.log('renameSessionApi optimistic update, prev:', prev, 'next:', next);
      return next;
    });

    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      console.log('renameSessionApi fetch response:', response.status);
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  };

  const toggleStarSessionApi = async (sessionId: string, isStarred: boolean) => {
    console.log('toggleStarSessionApi called with:', { sessionId, isStarred, authToken });
    if (!authToken) return;

    // Optimistic update
    setSessions(prev => {
      const next = prev.map(s => s.id === sessionId ? { ...s, isStarred } : s);
      console.log('toggleStarSessionApi optimistic update, prev:', prev, 'next:', next);
      return next;
    });

    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ isStarred })
      });
      console.log('toggleStarSessionApi fetch response:', response.status);
    } catch (e) {
      console.error('Failed to toggle star session:', e);
    }
  };

  return {
    messages,
    isLoading,
    sendMessage,
    editMessage,
    sessions,
    activeSessionId,
    currentUser,
    selectSession,
    createNewSession,
    deleteSession,
    renameSession: renameSessionApi,
    toggleStarSession: toggleStarSessionApi,
    searchSessions: searchSessionsApi
  };
};
