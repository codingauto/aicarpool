'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // 自动移除
    const duration = toast.duration || 3000;
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 触发进入动画
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    const base = 'flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border pointer-events-auto transition-all duration-200 transform';
    const visibility = isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';
    
    switch (toast.type) {
      case 'success':
        return `${base} ${visibility} bg-green-50 border-green-200`;
      case 'error':
        return `${base} ${visibility} bg-red-50 border-red-200`;
      case 'warning':
        return `${base} ${visibility} bg-yellow-50 border-yellow-200`;
      case 'info':
        return `${base} ${visibility} bg-blue-50 border-blue-200`;
    }
  };

  return (
    <div className={getStyles()}>
      {getIcon()}
      <div className="flex-1">
        <h4 className="font-medium text-sm text-gray-900">{toast.title}</h4>
        {toast.description && (
          <p className="text-sm text-gray-600 mt-1">{toast.description}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// 便捷函数
export const toast = {
  success: (title: string, description?: string) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toast', {
        detail: { type: 'success', title, description }
      });
      window.dispatchEvent(event);
    }
  },
  error: (title: string, description?: string) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toast', {
        detail: { type: 'error', title, description }
      });
      window.dispatchEvent(event);
    }
  },
  warning: (title: string, description?: string) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toast', {
        detail: { type: 'warning', title, description }
      });
      window.dispatchEvent(event);
    }
  },
  info: (title: string, description?: string) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toast', {
        detail: { type: 'info', title, description }
      });
      window.dispatchEvent(event);
    }
  }
};

// 全局事件监听器组件
export function ToastListener() {
  const { addToast } = useToast();

  useEffect(() => {
    const handleToast = (event: CustomEvent) => {
      addToast(event.detail);
    };

    window.addEventListener('toast', handleToast as any);
    return () => {
      window.removeEventListener('toast', handleToast as any);
    };
  }, [addToast]);

  return null;
}