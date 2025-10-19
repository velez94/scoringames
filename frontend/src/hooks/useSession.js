import { useState, useEffect } from 'react';
import { API } from 'aws-amplify';

/**
 * Session Management Hook
 * Tracks user sessions with automatic activity updates
 */
export const useSession = () => {
  const [sessionId, setSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Create session on mount
  useEffect(() => {
    createSession();
  }, []);

  // Update activity every 5 minutes
  useEffect(() => {
    if (!sessionId) return;

    const interval = setInterval(() => {
      updateActivity();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [sessionId]);

  const createSession = async () => {
    try {
      setLoading(true);
      const response = await API.post('CalisthenicsAPI', '/sessions', {
        body: {
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        },
      });
      setSessionId(response.sessionId);
      return response.sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateActivity = async () => {
    if (!sessionId) return;
    try {
      await API.get('CalisthenicsAPI', `/sessions/${sessionId}`);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const getSessions = async () => {
    try {
      setLoading(true);
      const response = await API.get('CalisthenicsAPI', '/sessions');
      setSessions(response);
      return response;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (id = sessionId) => {
    try {
      await API.del('CalisthenicsAPI', `/sessions/${id}`);
      if (id === sessionId) {
        setSessionId(null);
      }
      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  };

  return {
    sessionId,
    sessions,
    loading,
    createSession,
    getSessions,
    endSession,
    updateActivity,
  };
};
