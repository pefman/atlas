import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AppPageProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  top?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function AppPage({
  title,
  subtitle,
  actions,
  top,
  children,
  className,
  contentClassName,
}: AppPageProps) {
  const showHeader = Boolean(title || subtitle || actions);

  return (
    <div className={cn('page-shell', className)}>
      <div className={cn('page-container page-stack', contentClassName)}>
        {top}
        {showHeader && (
          <div className="page-header">
            <div className="space-y-1">
              {title && <h2 className="page-title">{title}</h2>}
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}