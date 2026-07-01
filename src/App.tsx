import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { DashboardPage } from '@/pages/DashboardPage';
import { KanbanPage } from '@/pages/KanbanPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { Toaster } from '@/components/ui/sonner';

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <TaskDetail taskId={parseInt(id!)} onBack={() => navigate('/')} />;
}

function App() {
  return (
    <Router>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/task/:id" element={<TaskDetailPage />} />
          </Routes>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </Router>
  );
}

export default App;
