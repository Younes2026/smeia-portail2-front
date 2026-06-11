import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';

type ToastTone = 'info' | 'success' | 'error';

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
};

type Toast = ToastInput & {
  id: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toneBorderColor: Record<ToastTone, string> = {
  info: colors.light.status.info,
  success: colors.light.status.success,
  error: colors.light.status.danger,
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== id)
    );
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nextToast: Toast = {
        ...toast,
        id,
        tone: toast.tone ?? 'info',
      };

      setToasts((currentToasts) => [nextToast, ...currentToasts].slice(0, 3));
      setTimeout(() => {
        dismissToast(id);
      }, 5000);

      return id;
    },
    [dismissToast]
  );

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.viewport}>
        {toasts.map((toast) => (
          <View
            key={toast.id}
            style={[
              styles.toast,
              { borderLeftColor: toneBorderColor[toast.tone] },
            ]}
          >
            <View style={styles.toastContent}>
              <Text style={styles.title}>{toast.title}</Text>
              {toast.message ? (
                <Text style={styles.message}>{toast.message}</Text>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                dismissToast(toast.id);
              }}
              style={({ hovered, pressed }) => [
                styles.closeButton,
                hovered && styles.closeButtonHovered,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Text style={styles.closeButtonText}>X</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToasts() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToasts must be used within ToastProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 1000,
    alignItems: 'center',
    gap: spacing.sm,
  },

  toast: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderLeftWidth: spacing.xs,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
  },

  toastContent: {
    flex: 1,
    gap: spacing.xs,
  },

  title: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
    color: colors.light.text.primary,
  },

  message: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
    color: colors.light.text.secondary,
  },

  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
  },

  closeButtonHovered: {
    backgroundColor: colors.light.background.muted,
  },

  closeButtonPressed: {
    opacity: 0.8,
  },

  closeButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.light.text.secondary,
  },
});
