import { useState } from 'react';
import { Modal, Stack, Text, Button, Group, Alert, Checkbox } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ConfirmationDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  loading?: boolean;
  itemCount?: number;
  requireDoubleConfirm?: boolean; // For bulk operations >5 items
  warningMessage?: string;
}

export function ConfirmationDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'red',
  loading = false,
  itemCount,
  requireDoubleConfirm = false,
  warningMessage,
}: ConfirmationDialogProps) {
  const [doubleConfirmChecked, setDoubleConfirmChecked] = useState(false);

  // Determine if we need double confirmation (bulk operations with >5 items)
  const needsDoubleConfirm = requireDoubleConfirm || (itemCount !== undefined && itemCount > 5);

  const handleConfirm = () => {
    onConfirm();
    // Reset double confirm state when closing
    setDoubleConfirmChecked(false);
  };

  const handleClose = () => {
    setDoubleConfirmChecked(false);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={title}
      centered
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        {/* Warning Alert */}
        {(needsDoubleConfirm || warningMessage) && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
            {warningMessage || `You are about to ${title.toLowerCase()} ${itemCount} items. This action cannot be undone.`}
          </Alert>
        )}

        {/* Main message */}
        <Text size="sm">
          {message}
          {itemCount !== undefined && itemCount > 0 && (
            <Text component="span" fw={700} c={confirmColor}>
              {' '}({itemCount} item{itemCount !== 1 ? 's' : ''})
            </Text>
          )}
        </Text>

        {/* Double confirmation checkbox for bulk operations */}
        {needsDoubleConfirm && (
          <Checkbox
            label={`I understand this will affect ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            checked={doubleConfirmChecked}
            onChange={(e) => setDoubleConfirmChecked(e.currentTarget.checked)}
            color={confirmColor}
          />
        )}

        {/* Action buttons */}
        <Group justify="flex-end" mt="md">
          <Button
            variant="subtle"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            color={confirmColor}
            onClick={handleConfirm}
            loading={loading}
            disabled={needsDoubleConfirm && !doubleConfirmChecked}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
