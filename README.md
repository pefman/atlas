# AI Task Executor

A web-based AI task execution system where users create tasks assigned to AI roles (Planner, Researcher, Writer, Reviewer) that decompose into subtasks and execute through an iterative loop.

## Features

- **Task Management**: Create, monitor, and manage AI tasks
- **Role-Based Execution**: Assign tasks to specialized AI roles
- **Kanban Board**: Visualize task progress with Backlog → In Progress → Review → Done flow
- **AI Provider Support**: Configure Ollama or OpenAI as the AI backend
- **Execution Logs**: Track intermediate steps and AI reasoning
- **Task Decomposition**: AI automatically breaks down tasks into subtasks

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: Express, better-sqlite3 (SQLite)
- **AI Providers**: Ollama (default), OpenAI

## Prerequisites

- Node.js 18+
- npm or yarn
- (Optional) Ollama running locally for AI execution

## Installation

```bash
npm install
```

## Development

Start both the frontend and backend:

```bash
npm run dev
```

This starts:
- Vite dev server on http://localhost:5173
- Express API server on http://localhost:3001

The Vite dev server proxies `/api` requests to the Express server.

## Production Build

```bash
npm run build
```

The built files are in the `dist/` directory.

## Configuration

1. Open http://localhost:5173
2. Navigate to **Settings** in the sidebar
3. Configure your AI provider:
   - **Ollama**: Set endpoint (default: `http://localhost:11434`) and model (default: `llama3`)
   - **OpenAI**: Set API key and model name

## Usage

1. **Create a Task**: Click "Create Task" on the dashboard
2. **Assign a Role**: Choose from Planner, Researcher, Writer, or Reviewer
3. **Execute**: Click the Play button to start execution
4. **Monitor**: Watch progress in the Kanban board
5. **View Details**: Click on a task to see subtasks and execution logs

## Project Structure

```
├── server/           # Express backend
│   ├── index.ts     # Server entry point
│   ├── db.ts        # Database initialization
│   ├── executor.ts  # Task execution engine
│   ├── ai/          # AI provider implementations
│   └── routes/      # API routes
├── src/             # React frontend
│   ├── components/  # UI components
│   ├── pages/       # Page components
│   └── types/       # TypeScript types
├── data/            # SQLite database (created on first run)
└── dist/            # Production build output
```

## API Endpoints

- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks/:id` - Get task with subtasks
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete a task
- `GET /api/subtasks/task/:taskId` - Get subtasks for a task
- `POST /api/subtasks` - Create a subtask
- `GET /api/roles` - List available roles
- `GET /api/settings` - Get AI provider settings
- `PUT /api/settings` - Update AI provider settings
- `POST /api/execute/task/:id` - Execute a task
- `POST /api/execute/subtask/:id` - Execute a subtask
- `GET /api/execute/logs/:subtaskId` - Get execution logs

## Database

The application uses SQLite for persistence. The database file is created at `data/tasks.db` on first run.

Tables:
- `roles` - AI roles (Planner, Researcher, Writer, Reviewer)
- `tasks` - User-created tasks
- `subtasks` - Decomposed subtasks
- `outputs` - AI-generated outputs
- `execution_logs` - Step-by-step execution history
- `settings` - AI provider configuration

## License

MIT
