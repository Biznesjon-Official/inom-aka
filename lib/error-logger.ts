// Error logging utility
export interface ErrorLog {
  timestamp: string
  type: 'sale' | 'payment' | 'return' | 'debt' | 'product' | 'other'
  action: string
  error: string
  userId?: string
  data?: any
}

const MAX_LOGS = 100

export function logError(log: Omit<ErrorLog, 'timestamp'>) {
  try {
    const logs = getErrorLogs()
    const newLog: ErrorLog = {
      ...log,
      timestamp: new Date().toISOString(),
    }
    
    logs.unshift(newLog)
    
    // Keep only last 100 logs
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS)
    }
    
    localStorage.setItem('error_logs', JSON.stringify(logs))
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', newLog)
    }
  } catch (err) {
    console.error('Failed to log error:', err)
  }
}

export function getErrorLogs(): ErrorLog[] {
  try {
    const stored = localStorage.getItem('error_logs')
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function clearErrorLogs() {
  localStorage.removeItem('error_logs')
}

export function downloadErrorLogs() {
  const logs = getErrorLogs()
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error_logs_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
