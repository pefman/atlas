import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { KanbanPage } from '@/pages/KanbanPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ReposPage } from '@/pages/ReposPage';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { SubtaskDetail } from '@/components/tasks/SubtaskDetail';
import { AgentDetail } from '@/components/agents/AgentDetail';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { AppPage } from '@/components/layout/AppPage';
import { AIStatusIndicator } from '@/components/AIStatusIndicator';
import { KanbanStreamProvider } from '@/contexts/KanbanStreamContext';

interface AppSidebarProps {
  openCommandPalette: () => void;
  selectedAgent?: Agent | null;
  onAgentSelect?: (agent: Agent | null) => void;
}

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <TaskDetail taskId={parseInt(id!)} onBack={() => navigate(-1)} />;
}

function SubtaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <SubtaskDetail subtaskId={parseInt(id!)} onBack={() => navigate(-1)} />;
}

function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentId = parseInt(id!);
  
  const [agent, setAgent] = useState<Agent | null>(null);
  
  useEffect(() => {
    fetch(`/api/agents/${agentId}`)
      .then(res => res.json())
      .then(setAgent)
      .catch(console.error);
  }, [agentId]);
  
  if (!agent) {
    return <AppPage><div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppPage>;
  }
  
  return (
    <AppPage
      title={agent.name}
      actions={
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="h-4 w-4" />
        </Button>
      }
    >
      <AgentDetail agent={agent} onClose={() => navigate(-1)} />
    </AppPage>
  );
}

function App() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <NotificationProvider>
      <KanbanStreamProvider>
        <Router>
          <SidebarProvider>
            <AppSidebar 
              selectedAgent={selectedAgent}
              onAgentSelect={setSelectedAgent}
            />
            <SidebarInset>
              <SiteHeader />
              <Routes>
                <Route path="/" element={<KanbanPage />} />
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/tasks" element={<DashboardPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/repos" element={<ReposPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/task/:id" element={<TaskDetailPage />} />
                <Route path="/subtask/:id" element={<SubtaskDetailPage />} />
                <Route path="/agent/:id" element={<AgentDetailPage />} />
              </Routes>
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
          <AIStatusIndicator />
        </Router>
      </KanbanStreamProvider>
    </NotificationProvider>
  );
}

export default App;
