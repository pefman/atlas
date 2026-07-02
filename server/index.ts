import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import settingsRoutes from './routes/settings';
import executeRoutes from './routes/execute';
import executeSubtaskRoutes from './routes/executeSubtask';
import roleRoutes from './routes/roles';
import agentRoutes from './routes/agents';
import notificationsRouter from './routes/notifications';
import notificationsStreamRouter from './routes/notificationsStream';
import kanbanStreamRouter from './routes/kanbanStream';
import activityRouter from './routes/activity';
import metricsRouter from './routes/metrics';
import { db } from './db';
import { scheduler } from './scheduler';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();
const PORT = Number(process.env.PORT || 3101);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/execute', executeSubtaskRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api/notifications/stream', notificationsStreamRouter);
app.use('/api/kanban/stream', kanbanStreamRouter);
app.use('/api/activity', activityRouter);
app.use('/api/metrics', metricsRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  scheduler.start();
});

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60);
