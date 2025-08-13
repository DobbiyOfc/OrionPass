import React, { createContext, useState, useCallback, useContext, ReactNode, useEffect } from 'react';
import { LogEntry, LogLevel } from '../types';

interface LogContextType {
  logs: LogEntry[];
  addLog: (message: string, level?: LogLevel, source?: string) => void;
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const useLog = () => {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLog must be used within a LogProvider');
  }
  return context;
};

export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, level: LogLevel = 'info', source: string = 'App') => {
    // Prevent logs from growing indefinitely in memory
    setLogs(prevLogs => [...prevLogs.slice(-200), { timestamp: Date.now(), message, level, source }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    const formatArgs = (args: any[]): string => {
      return args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.stack || arg.message;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }).join(' ');
    };

    console.log = (...args: any[]) => {
      originalConsole.log.apply(console, args);
      addLog(formatArgs(args), 'info', 'Console');
    };
    console.info = (...args: any[]) => {
      originalConsole.info.apply(console, args);
      addLog(formatArgs(args), 'info', 'Console');
    };
    console.warn = (...args: any[]) => {
      originalConsole.warn.apply(console, args);
      addLog(formatArgs(args), 'warn', 'Console');
    };
    console.error = (...args: any[]) => {
      originalConsole.error.apply(console, args);
      addLog(formatArgs(args), 'error', 'Console');
    };
    console.debug = (...args: any[]) => {
      originalConsole.debug.apply(console, args);
      addLog(formatArgs(args), 'debug', 'Console');
    };
    
    return () => {
      console.log = originalConsole.log;
      console.info = originalConsole.info;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    };
  }, [addLog]);
  
  const value = { logs, addLog, clearLogs };

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
};
