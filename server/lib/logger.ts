export function logTask(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.log(`[${timestamp}] [Task] ${action}:`, formatDetails(details));
}

export function logTaskError(error: Error, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.error(`[${timestamp}] [Task] Error:`, formatError(error), formatDetails(details));
}

export function logSubtask(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.log(`[${timestamp}] [Subtask] ${action}:`, formatDetails(details));
}

export function logSubtaskError(error: Error, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.error(`[${timestamp}] [Subtask] Error:`, formatError(error), formatDetails(details));
}

export function logCEO(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.log(`[${timestamp}] [CEO] ${action}:`, formatDetails(details));
}

export function logCEOError(error: Error, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.error(`[${timestamp}] [CEO] Error:`, formatError(error), formatDetails(details));
}

export function logSystem(message: string) {
  const timestamp = new Date().toISOString().split('T').join(' ').slice(0, 19);
  console.log(`[${timestamp}] [System] ${message}`);
}

function formatDetails(details: Record<string, any>): string {
  return Object.entries(details)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? `"${v}"` : v}`)
    .join(', ');
}

function formatError(error: Error): string {
  return `[${error.message}]`;
}
