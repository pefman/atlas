import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { DashboardPage } from '@/pages/DashboardPage';
import { KanbanPage } from '@/pages/KanbanPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { Toaster } from '@/components/ui/sonner';
import { CommandPalette } from '@/components/ui/command-palette';

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <TaskDetail taskId={parseInt(id!)} onBack={() => navigate('/kanban')} />;
}

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <NotificationProvider>
      <Router>
        <SidebarProvider>
          <AppSidebar openCommandPalette={() => setCommandPaletteOpen(true)} />
          <SidebarInset>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<KanbanPage />} />
              <Route path="/kanban" element={<KanbanPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/task/:id" element={<TaskDetailPage />} />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
      </Router>
    </NotificationProvider>
  );
}

export default App;
