import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useToasts } from '@/components/feedback/ToastProvider';
import type {
  CrcAppointmentAction,
  CrcAppointmentActionResult,
  CrcAppointmentActionVariables,
  CrcAppointmentStatus,
  CrcRejectionReasonCode,
} from '@/core/api/crc-appointments.api';
import { colors } from '@/core/theme/colors';
import { spacing } from '@/core/theme/spacing';
import { typography } from '@/core/theme/typography';
import { useCrcAppointmentAction } from '@/features/crc/requests/hooks/useCrcAppointmentAction';
import {
  CRC_REJECTION_REASON_OPTIONS,
  createCrcIdempotencyKey,
  getCrcActionErrorMessage,
  getCrcActionSuccessCopy,
  isCrcAppointmentActionable,
  optionalCrcNote,
} from '@/features/crc/requests/model/crc-appointment-actions';

type CrcAppointmentActionsProps = {
  appointmentId: number;
  status: CrcAppointmentStatus;
  onSuccess: (result: CrcAppointmentActionResult) => void;
};

type ActionButtonTone = 'danger' | 'neutral' | 'primary';

function ActionButton({
  disabled = false,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  tone: ActionButtonTone;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.actionButton,
        tone === 'danger' && styles.actionButtonDanger,
        tone === 'neutral' && styles.actionButtonNeutral,
        tone === 'primary' && styles.actionButtonPrimary,
        hovered && !disabled && styles.actionButtonHovered,
        pressed && !disabled && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          tone === 'neutral' && styles.actionButtonTextNeutral,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FormField({
  label,
  maxLength,
  onChangeText,
  placeholder,
  required = false,
  value,
}: {
  label: string;
  maxLength: number;
  onChangeText: (value: string) => void;
  placeholder: string;
  required?: boolean;
  value: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        maxLength={maxLength}
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.light.text.muted}
        style={styles.textInput}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

export function CrcAppointmentActions({
  appointmentId,
  status,
  onSuccess,
}: CrcAppointmentActionsProps) {
  const { showToast } = useToasts();
  const actionMutation = useCrcAppointmentAction();
  const [activeAction, setActiveAction] =
    useState<CrcAppointmentAction | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [publicMessage, setPublicMessage] = useState('');
  const [reasonCode, setReasonCode] =
    useState<CrcRejectionReasonCode>('service_unavailable');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isCrcAppointmentActionable(status)) {
    return null;
  }

  const resetForm = () => {
    actionMutation.reset();
    setActiveAction(null);
    setIdempotencyKey(null);
    setInternalNote('');
    setPublicMessage('');
    setReasonCode('service_unavailable');
    setFormError(null);
  };

  const openAction = (action: CrcAppointmentAction) => {
    actionMutation.reset();
    setActiveAction(action);
    setIdempotencyKey(createCrcIdempotencyKey());
    setInternalNote('');
    setPublicMessage('');
    setReasonCode('service_unavailable');
    setFormError(null);
  };

  const submitAction = () => {
    if (activeAction === null || idempotencyKey === null) {
      return;
    }

    const normalizedInternalNote = optionalCrcNote(internalNote);
    let variables: CrcAppointmentActionVariables;

    if (activeAction === 'callback') {
      variables = {
        appointmentId,
        action: activeAction,
        idempotencyKey,
        body:
          normalizedInternalNote === undefined
            ? {}
            : { internal_note: normalizedInternalNote },
      };
    } else if (activeAction === 'reject') {
      if (reasonCode === 'other' && normalizedInternalNote === undefined) {
        setFormError('La note interne est obligatoire pour le motif Autre.');
        return;
      }
      const normalizedPublicMessage = optionalCrcNote(publicMessage);
      variables = {
        appointmentId,
        action: activeAction,
        idempotencyKey,
        body: {
          reason_code: reasonCode,
          ...(normalizedPublicMessage === undefined
            ? {}
            : { public_message: normalizedPublicMessage }),
          ...(normalizedInternalNote === undefined
            ? {}
            : { internal_note: normalizedInternalNote }),
        },
      };
    } else {
      variables = {
        appointmentId,
        action: activeAction,
        idempotencyKey,
        body:
          normalizedInternalNote === undefined
            ? {}
            : { internal_note: normalizedInternalNote },
      };
    }

    setFormError(null);
    actionMutation.mutate(variables, {
      onSuccess: (result) => {
        const toast = getCrcActionSuccessCopy(result.action);
        showToast({ ...toast, tone: 'success' });
        resetForm();
        onSuccess(result);
      },
      onError: (error) => {
        const message = getCrcActionErrorMessage(error);
        setFormError(message);
        showToast({ title: 'Action CRC impossible', message, tone: 'error' });
      },
    });
  };

  const isPending = actionMutation.isPending;

  return (
    <View style={styles.actionsSection}>
      <View style={styles.actionsHeading}>
        <View style={styles.actionsHeadingCopy}>
          <Text style={styles.sectionEyebrow}>TRAITEMENT CRC</Text>
          <Text style={styles.sectionTitle}>Actions sur la demande</Text>
        </View>
        <View style={styles.actionsBar}>
          <ActionButton
            disabled={isPending}
            label="Client à relancer"
            onPress={() => openAction('callback')}
            tone="neutral"
          />
          <ActionButton
            disabled={isPending}
            label="Refuser"
            onPress={() => openAction('reject')}
            tone="danger"
          />
          <ActionButton
            disabled={isPending}
            label="Confirmer"
            onPress={() => openAction('confirm')}
            tone="primary"
          />
        </View>
      </View>

      {activeAction ? (
        <View style={styles.actionPanel}>
          <View style={styles.actionPanelHeading}>
            <Text style={styles.actionPanelTitle}>
              {activeAction === 'callback'
                ? 'Ajouter aux clients à relancer'
                : activeAction === 'reject'
                  ? 'Refuser cette demande'
                  : 'Confirmer ce rendez-vous ?'}
            </Text>
            <Text style={styles.actionPanelMessage}>
              {activeAction === 'callback'
                ? 'La demande sera placée dans la file Clients à relancer.'
                : activeAction === 'reject'
                  ? 'Sélectionnez le motif du refus avant de valider.'
                  : 'Le statut du rendez-vous passera à Confirmée.'}
            </Text>
          </View>

          {activeAction === 'reject' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Motif du refus *</Text>
              <View style={styles.reasonGrid}>
                {CRC_REJECTION_REASON_OPTIONS.map((reason) => {
                  const isSelected = reason.code === reasonCode;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      disabled={isPending}
                      key={reason.code}
                      onPress={() => {
                        setReasonCode(reason.code);
                        setFormError(null);
                      }}
                      style={({ hovered, pressed }) => [
                        styles.reasonOption,
                        isSelected && styles.reasonOptionSelected,
                        hovered && !isSelected && styles.reasonOptionHovered,
                        pressed && styles.controlPressed,
                        isPending && styles.controlDisabled,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioIndicator,
                          isSelected && styles.radioIndicatorSelected,
                        ]}
                      />
                      <Text style={styles.reasonOptionText}>{reason.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {activeAction === 'reject' ? (
            <FormField
              label="Message client"
              maxLength={500}
              onChangeText={setPublicMessage}
              placeholder="Message facultatif visible par le client"
              value={publicMessage}
            />
          ) : null}

          <FormField
            label="Note interne"
            maxLength={1000}
            onChangeText={(value) => {
              setInternalNote(value);
              setFormError(null);
            }}
            placeholder="Ajouter une note facultative pour le suivi CRC"
            required={activeAction === 'reject' && reasonCode === 'other'}
            value={internalNote}
          />

          {formError ? (
            <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.panelActions}>
            <ActionButton
              disabled={isPending}
              label="Annuler"
              onPress={resetForm}
              tone="neutral"
            />
            <ActionButton
              disabled={isPending}
              label={isPending ? 'Enregistrement...' : 'Valider l’action'}
              onPress={submitAction}
              tone={activeAction === 'reject' ? 'danger' : 'primary'}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actionsSection: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    gap: spacing.lg,
  },
  actionsHeading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actionsHeadingCopy: {
    gap: spacing.xs,
  },
  sectionEyebrow: {
    color: colors.light.text.muted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semiBold,
    letterSpacing: 0.8,
  },
  sectionTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semiBold,
  },
  actionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: spacing.sm,
  },
  actionButtonNeutral: {
    borderColor: colors.light.border.strong,
    backgroundColor: colors.light.background.primary,
  },
  actionButtonDanger: {
    borderColor: colors.light.status.danger,
    backgroundColor: colors.light.status.danger,
  },
  actionButtonPrimary: {
    borderColor: colors.light.brand.primary,
    backgroundColor: colors.light.brand.primary,
  },
  actionButtonHovered: {
    opacity: 0.88,
  },
  actionButtonText: {
    color: colors.light.text.inverse,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  actionButtonTextNeutral: {
    color: colors.light.text.primary,
  },
  actionPanel: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.secondary,
    gap: spacing.lg,
  },
  actionPanelHeading: {
    gap: spacing.xs,
  },
  actionPanelTitle: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semiBold,
  },
  actionPanelMessage: {
    color: colors.light.text.secondary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semiBold,
  },
  textInput: {
    minHeight: 88,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.strong,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonOption: {
    minWidth: 220,
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.border.default,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
  },
  reasonOptionSelected: {
    borderColor: colors.light.brand.primary,
    backgroundColor: colors.light.background.muted,
  },
  reasonOptionHovered: {
    borderColor: colors.light.border.strong,
  },
  radioIndicator: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: colors.light.border.strong,
    borderRadius: 7,
  },
  radioIndicatorSelected: {
    borderWidth: 4,
    borderColor: colors.light.brand.primary,
  },
  reasonOptionText: {
    flex: 1,
    color: colors.light.text.primary,
    fontSize: typography.fontSize.sm,
  },
  errorBanner: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.light.status.danger,
    borderRadius: spacing.sm,
    backgroundColor: colors.light.background.primary,
  },
  errorText: {
    color: colors.light.status.danger,
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.sm,
  },
  panelActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  controlPressed: {
    opacity: 0.8,
  },
  controlDisabled: {
    opacity: 0.5,
  },
});
