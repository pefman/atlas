import { createContext, useContext, useEffect, useState } from 'react';
import { Notification } from '@/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await fetchNotifications();
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.addEventListener('notification', (event) => {
      const newNotification = JSON.parse(event.data);
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => eventSource.close();
  }, []);

  const value = { notifications, unreadCount, markAsRead, refresh: fetchNotifications };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
