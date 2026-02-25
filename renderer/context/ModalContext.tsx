import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type AlertResolve = () => void;
type ConfirmResolve = (value: boolean) => void;

export type AlertVariant = 'info' | 'success' | 'error';

type ModalState =
  | { type: 'alert'; message: string; variant: AlertVariant; resolve: AlertResolve }
  | { type: 'confirm'; message: string; resolve: ConfirmResolve }
  | null;

type ModalContextValue = {
  alert: (message: string, variant?: AlertVariant) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;
};

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return ctx;
}

type ModalProviderProps = { children: ReactNode };

export function ModalProvider({ children }: ModalProviderProps) {
  const [state, setState] = useState<ModalState>(null);

  const alert = useCallback((message: string, variant: AlertVariant = 'info') => {
    return new Promise<void>((resolve) => {
      setState({
        type: 'alert',
        message,
        variant,
        resolve: () => {
          setState(null);
          resolve();
        },
      });
    });
  }, []);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({
        type: 'confirm',
        message,
        resolve: (value) => {
          setState(null);
          resolve(value);
        },
      });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (state?.type === 'alert') {
      state.resolve();
    } else if (state?.type === 'confirm') {
      state.resolve(false);
    }
  }, [state]);

  const handleConfirm = useCallback(() => {
    if (state?.type === 'alert') {
      state.resolve();
    } else if (state?.type === 'confirm') {
      state.resolve(true);
    }
  }, [state]);

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div
            className={`modal-dialog${state.type === 'alert' ? ` modal-dialog--${state.variant}` : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="modal-title" className="modal-message">{state.message}</p>
            <div className="modal-actions">
              {state.type === 'confirm' && (
                <button type="button" className="button-secondary modal-btn" onClick={handleClose}>
                  Cancel
                </button>
              )}
              <button type="button" className="button-primary modal-btn" onClick={handleConfirm} autoFocus>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
