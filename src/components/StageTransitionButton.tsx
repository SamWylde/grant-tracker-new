import { useState } from 'react';
import {
  Button,
  Menu,
  Modal,
  Stack,
  Textarea,
  Alert,
  Badge,
  Group,
} from '@mantine/core';
import {
  IconChevronDown,
  IconCheck,
  IconLock,
  IconArrowRight,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  createApprovalRequest,
  checkTransitionRequiresApproval,
} from '../utils/approvalsApi';
import type { GrantStage } from '../types/approvals';
import { COMMON_STAGE_TRANSITIONS, getStageLabel, getStageColor } from '../types/approvals';

interface StageTransitionButtonProps {
  grantId: string;
  orgId: string;
  currentStage: GrantStage;
  onStageChanged?: () => void;
}

interface TransitionModalProps {
  opened: boolean;
  onClose: () => void;
  grantId: string;
  fromStage: GrantStage;
  toStage: GrantStage;
  requiresApproval: boolean;
  onSuccess?: () => void;
}

function TransitionModal({
  opened,
  onClose,
  grantId,
  fromStage,
  toStage,
  requiresApproval,
  onSuccess,
}: TransitionModalProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const directUpdateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('org_grants_saved')
        .update({ status: toStage })
        .eq('id', grantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
      notifications.show({
        title: 'Success',
        message: `Grant moved to ${getStageLabel(toStage)}`,
        color: 'green',
      });
      setNotes('');
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update grant stage',
        color: 'red',
      });
    },
  });

  const approvalRequestMutation = useMutation({
    mutationFn: createApprovalRequest,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });

      if ('auto_approved' in result && result.auto_approved) {
        notifications.show({
          title: 'Auto-Approved',
          message: result.message || 'Stage transition approved automatically',
          color: 'green',
        });
        queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
      } else {
        notifications.show({
          title: 'Approval Requested',
          message: 'Your stage transition request has been submitted for approval',
          color: 'blue',
        });
      }

      setNotes('');
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create approval request',
        color: 'red',
      });
    },
  });

  const handleSubmit = () => {
    if (requiresApproval) {
      approvalRequestMutation.mutate({
        grant_id: grantId,
        from_stage: fromStage,
        to_stage: toStage,
        request_notes: notes.trim() || undefined,
      });
    } else {
      directUpdateMutation.mutate();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Move to ${getStageLabel(toStage)}`}
      size="md"
    >
      <Stack gap="md">
        <Group>
          <Badge color={getStageColor(fromStage)} size="lg">
            {getStageLabel(fromStage)}
          </Badge>
          <IconArrowRight size={20} />
          <Badge color={getStageColor(toStage)} size="lg">
            {getStageLabel(toStage)}
          </Badge>
        </Group>

        {requiresApproval ? (
          <Alert icon={<IconLock size={16} />} color="blue" variant="light">
            This stage transition requires approval. Your request will be sent to the appropriate
            approvers.
          </Alert>
        ) : (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            This stage transition will be applied immediately.
          </Alert>
        )}

        <Textarea
          label={requiresApproval ? 'Request Notes' : 'Notes (Optional)'}
          placeholder={
            requiresApproval
              ? 'Explain why you are requesting this stage change...'
              : 'Add any notes about this stage change...'
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={directUpdateMutation.isPending || approvalRequestMutation.isPending}
          >
            {requiresApproval ? 'Request Approval' : 'Update Stage'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function StageTransitionButton({
  grantId,
  orgId,
  currentStage,
  onStageChanged,
}: StageTransitionButtonProps) {
  const [transitionModalOpened, setTransitionModalOpened] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<{
    to: GrantStage;
    requiresApproval: boolean;
  } | null>(null);

  // Get available transitions for current stage
  const availableTransitions = COMMON_STAGE_TRANSITIONS.filter(
    (t) => t.from === currentStage
  );

  // Check approval requirements for each transition
  const { data: transitionsWithApproval } = useQuery({
    queryKey: ['stageTransitions', orgId, currentStage],
    queryFn: async () => {
      const results = await Promise.all(
        availableTransitions.map(async (transition) => {
          const { requiresApproval, workflowId } = await checkTransitionRequiresApproval(
            orgId,
            transition.from,
            transition.to
          );
          return {
            ...transition,
            requiresApproval,
            workflowId,
          };
        })
      );
      return results;
    },
    enabled: availableTransitions.length > 0,
  });

  const handleTransitionClick = (toStage: GrantStage, requiresApproval: boolean) => {
    setSelectedTransition({ to: toStage, requiresApproval });
    setTransitionModalOpened(true);
  };

  const handleCloseModal = () => {
    setTransitionModalOpened(false);
    setSelectedTransition(null);
  };

  if (!transitionsWithApproval || transitionsWithApproval.length === 0) {
    return null;
  }

  return (
    <>
      <Menu position="bottom-end" shadow="md">
        <Menu.Target>
          <Button
            variant="light"
            rightSection={<IconChevronDown size={16} />}
            size="sm"
          >
            Change Stage
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Move to:</Menu.Label>
          {transitionsWithApproval.map((transition) => (
            <Menu.Item
              key={transition.to}
              leftSection={
                transition.requiresApproval ? (
                  <IconLock size={14} />
                ) : (
                  <IconCheck size={14} />
                )
              }
              rightSection={
                transition.requiresApproval && (
                  <Badge size="xs" color="blue" variant="light">
                    Approval Required
                  </Badge>
                )
              }
              onClick={() => handleTransitionClick(transition.to, transition.requiresApproval)}
            >
              {transition.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>

      {selectedTransition && (
        <TransitionModal
          opened={transitionModalOpened}
          onClose={handleCloseModal}
          grantId={grantId}
          fromStage={currentStage}
          toStage={selectedTransition.to}
          requiresApproval={selectedTransition.requiresApproval}
          onSuccess={onStageChanged}
        />
      )}
    </>
  );
}
