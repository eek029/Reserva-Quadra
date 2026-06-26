type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogContext {
  endpoint?: string
  userId?: string
  statusCode?: number
  duration?: number
  [key: string]: unknown
}

class SecureLogger {
  private isDev = process.env.NODE_ENV === 'development'

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'cpf', 'rg', 'key', 'apikey']
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
        result[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.sanitize(value as Record<string, unknown>)
      } else {
        result[key] = value
      }
    }

    return result
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString()
    const sanitized = context ? this.sanitize(context as Record<string, unknown>) : {}

    const logEntry = {
      timestamp,
      level,
      message,
      ...(sanitized as Record<string, unknown>),
    }

    if (this.isDev) {
      console.log(JSON.stringify(logEntry, null, 2))
    } else {
      // Em produção, enviar para serviço de logging (ex: Sentry, LogRocket)
      console.log(JSON.stringify(logEntry))
    }
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      this.log('debug', message, context)
    }
  }
}

export const logger = new SecureLogger()
