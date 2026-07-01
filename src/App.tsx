import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { NotificationProvider } from '@/components/notifications/NotificationProvider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { KanbanPage } from '@/pages/KanbanPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { AgentDetail } from '@/components/agents/AgentDetail';
import { Agent } from '@/types';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { CommandPalette } from '@/components/ui/command-palette';

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return <TaskDetail taskId={parseInt(id!)} onBack={() => navigate('/kanban')} />;
}

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <NotificationProvider>
      <Router>
        <SidebarProvider>
          <AppSidebar 
            openCommandPalette={() => setCommandPaletteOpen(true)} 
            selectedAgent={selectedAgent}
            onAgentSelect={setSelectedAgent}
          />
          <SidebarInset>
            <SiteHeader />
            {selectedAgent ? (
              <div className="flex-1 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-2xl font-bold">{selectedAgent.name}</h1>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
              </div>
            ) : (
              <Routes>
                <Route path="/" element={<KanbanPage />} />
                <Route path="/kanban" element={<KanbanPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/task/:id" element={<TaskDetailPage />} />
              </Routes>
            )}
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
      </Router>
    </NotificationProvider>
  );
}

export default App;
