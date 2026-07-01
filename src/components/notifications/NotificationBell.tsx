import { Bell } from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.task_id) {
      navigate(`/task/${notification.task_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notifications</p>
          ) : (
            notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`p-2 rounded-md cursor-pointer text-sm ${
                  notification.is_read ? 'bg-transparent' : 'bg-accent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{notification.sender_role}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs mt-1">{notification.message}</p>
                {notification.task_id && (
                  <p className="text-xs text-primary mt-1">View task #{notification.task_id}</p>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
