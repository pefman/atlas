import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/tasks';
import subtaskRoutes from './routes/subtasks';
import settingsRoutes from './routes/settings';
import executeRoutes from './routes/execute';
import { db } from './db';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/execute', executeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
