import { useState, useEffect } from 'react';
import type { Message } from '../types/chat';
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
        const mappedSessions = (data.sessions || []).map((s: any) => {
          let title = s.title || 'Hội thoại mới';
          if (title.length > 25) {
            title = title.substring(0, 25) + '...';
          }
          return {
            id: s.sessionId,
            session_code: s.sessionId,
            title: title,
            updatedAt: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStarred: s.isStarred || false
          };
        });

        if (mappedSessions.length === 0) {
          const emptyList = [{
            id: 'new-chat-session',
            session_code: 'new-chat-session',
            title: 'Hội thoại mới',
            updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStarred: false
          }];
          setSessions(emptyList);
          setActiveSessionId('new-chat-session');
          setMessages([]);
          return emptyList;
        } else {
          setSessions(mappedSessions);
          if (activeSessionId !== 'new-chat-session' && !mappedSessions.some((s: any) => s.id === activeSessionId)) {
            setActiveSessionId('new-chat-session');
          }
          return mappedSessions;
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
    return [];
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
    const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';
    if (authToken && currentUser && !isGuest) {
      fetchSessions(authToken);
      setActiveSessionId('new-chat-session');
      setMessages([]);
    } else {
      setSessions([]);
      setActiveSessionId('new-chat-session');
      setMessages([]);
    }
  }, [authToken, currentUser?.username, currentUser?.role]);

  // Sync messages on active session / token change
  useEffect(() => {
    const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';
    if (authToken && !isGuest) {
      fetchSessionDetails(authToken, activeSessionId);
    }
  }, [activeSessionId, authToken, currentUser]);

  const selectSession = (id: string) => {
    setActiveSessionId(id);
    if (authToken && id !== 'new-chat-session') {
      fetchSessionDetails(authToken, id);
    } else if (id === 'new-chat-session') {
      setMessages([]);
    }
  };

  const createNewSession = () => {
    setActiveSessionId('new-chat-session');
    setMessages([]);
  };

  const deleteSession = async (id: string) => {
    const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';
    const nextSessions = sessions.filter(s => s.id !== id);
    const updatedList = nextSessions.length > 0 ? nextSessions : [{
      id: 'new-chat-session',
      session_code: 'new-chat-session',
      title: 'Hội thoại mới',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isStarred: false
    }];

    setSessions(updatedList);
    if (activeSessionId === id || updatedList[0].id === 'new-chat-session') {
      setActiveSessionId('new-chat-session');
      setMessages([]);
    }

    if (authToken && id !== 'new-chat-session' && !isGuest) {
      try {
        await fetch(`/api/chat/sessions/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (e) {
        console.error('Failed to delete session:', e);
      }
    }
  };

  const editMessage = async (messageId: string, content: string) => {
    const timeStr = formatTimestamp();

    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

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

      const data = response.json ? await response.json().catch(() => ({})) : {};
      const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';
      const targetSessionId = data.sessionId || data.session_id || (activeSessionId === 'new-chat-session' ? `session-${Date.now()}` : activeSessionId);
      const hasDirectContent = Boolean(data.reply || data.answer || data.content || data.message || data.response || data.text);

      if (hasDirectContent || isGuest) {
        const newAiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          content: data.reply || data.answer || data.content || data.message || data.response || data.text || '',
          timestamp: formatTimestamp(),
          toolCalls: data.toolCalls
        };
        setMessages(prev => [...prev, newAiMsg]);

        if (!isGuest && authToken) {
          fetchSessions(authToken).catch(() => {});
        }
      } else {
        const updatedSessions = await fetchSessions(authToken!);
        const exists = updatedSessions && updatedSessions.some((s: any) => s.id === targetSessionId);
        const finalSessionId = exists ? targetSessionId : 'new-chat-session';

        setActiveSessionId(finalSessionId);
        await fetchSessionDetails(authToken!, finalSessionId);
      }
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
      const isGuest = currentUser?.username === 'guest' || currentUser?.role === 'viewer';
      const targetSessionId = data.sessionId || data.session_id || (activeSessionId === 'new-chat-session' ? `session-${Date.now()}` : activeSessionId);
      const hasDirectContent = Boolean(data.reply || data.answer || data.content || data.message || data.response || data.text);

      if (hasDirectContent || isGuest) {
        const newAiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          content: data.reply || data.answer || data.content || data.message || data.response || data.text || '',
          timestamp: formatTimestamp(),
          toolCalls: data.toolCalls
        };
        setMessages(prev => [...prev, newAiMsg]);

        if (!isGuest && authToken) {
          fetchSessions(authToken).catch(() => {});
        }
      } else {
        const updatedSessions = await fetchSessions(authToken!);
        const exists = updatedSessions && updatedSessions.some((s: any) => s.id === targetSessionId);
        const finalSessionId = exists ? targetSessionId : (updatedSessions && updatedSessions[0]?.id ? updatedSessions[0].id : targetSessionId);

        setActiveSessionId(finalSessionId);
        await fetchSessionDetails(authToken!, finalSessionId);
      }
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
    if (!authToken) return;

    // Optimistic update
    setSessions(prev => {
      return prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s);
    });

    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  };

  const toggleStarSessionApi = async (sessionId: string, isStarred: boolean) => {
    if (!authToken) return;

    // Optimistic update
    setSessions(prev => {
      return prev.map(s => s.id === sessionId ? { ...s, isStarred } : s);
    });

    try {
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ isStarred })
      });
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
