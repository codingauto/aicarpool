import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolver?: (value: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    confirmText: '确定',
    cancelText: '取消',
    variant: 'default'
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        ...options,
        resolver: resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state.resolver) {
      state.resolver(true);
    }
    setState(prev => ({ ...prev, open: false, resolver: undefined }));
  }, [state.resolver]);

  const handleCancel = useCallback(() => {
    if (state.resolver) {
      state.resolver(false);
    }
    setState(prev => ({ ...prev, open: false, resolver: undefined }));
  }, [state.resolver]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && state.resolver) {
      state.resolver(false);
    }
    setState(prev => ({ ...prev, open, resolver: open ? prev.resolver : undefined }));
  }, [state.resolver]);

  return {
    confirm,
    confirmState: state,
    handleConfirm,
    handleCancel,
    handleOpenChange
  };
}
