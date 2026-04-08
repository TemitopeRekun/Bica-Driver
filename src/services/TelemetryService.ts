import { APP_VERSION } from './Config';

export enum LogSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

interface LogContext {
  reqId?: string;
  userId?: string;
  role?: string;
  screen?: string;
  [key: string]: any;
}

class TelemetryService {
  private static instance: TelemetryService;
  private isProduction = import.meta.env.PROD;

  private constructor() {}

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  /**
   * Main logging method. In non-prod, it logs to console with rich formatting.
   * In production, this can be easily connected to Sentry, LogRocket, etc.
   */
  public log(severity: LogSeverity, message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    const metadata = {
      ...context,
      version: APP_VERSION,
      platform: window.navigator.platform,
      userAgent: window.navigator.userAgent,
    };

    if (!this.isProduction) {
      const color = severity === LogSeverity.ERROR ? 'color: #ff4d4f; font-weight: bold' : 
                    severity === LogSeverity.WARN ? 'color: #faad14; font-weight: bold' : 
                    'color: #1890ff; font-weight: bold';
      
      console.groupCollapsed(`%c[${severity.toUpperCase()}] ${message}`, color);
      console.log('Timestamp:', timestamp);
      console.log('Context:', metadata);
      if (context.error) console.error('Original Error:', context.error);
      console.groupEnd();
    } else {
      // PROD: Implement Sentry.captureMessage or equivalent here
      // For now, we still log to console but in a more compact format
      if (severity === LogSeverity.ERROR || severity === LogSeverity.CRITICAL) {
        console.error(`[${severity}] ${message}`, JSON.stringify(metadata));
      }
    }
  }

  public error(message: string, error?: any, context: LogContext = {}) {
    this.log(LogSeverity.ERROR, message, { ...context, error });
  }

  public warn(message: string, context: LogContext = {}) {
    this.log(LogSeverity.WARN, message, context);
  }

  public info(message: string, context: LogContext = {}) {
    this.log(LogSeverity.INFO, message, context);
  }

  /**
   * Tracks custom events (e.g. "ride_started", "login_success")
   */
  public trackEvent(eventName: string, properties: Record<string, any> = {}) {
     this.info(`Event: ${eventName}`, properties);
     // PROD: Implement Sentry.captureEvent or equivalent here
  }
}

export const telemetry = TelemetryService.getInstance();
