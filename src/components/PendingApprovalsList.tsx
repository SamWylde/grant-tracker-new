import { useState } from 'react';
import {
  Stack,
  Text,
  Badge,
  Group,
  Card,
  Alert,
  Button,
  Modal,
  Textarea,
  Tabs,
  Avatar,
  Box,
  Progress,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconX,
  IconClock,
  IconUser,
  IconFileText,
  IconChevronRight,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  fetchApprovalRequests,
  approveOrRejectRequest,
} from '../utils/approvalsApi';
import type { ApprovalRequest, ApprovalDecision } from '../types/approvals';
import {
  formatTransitionLabel,
  getApprovalProgress,
  isRequestExpired,
  getStageColor,
} from '../types/approvals';

interface ApprovalActionModalProps {
  request: ApprovalRequest | null;
  opened: boolean;
  onClose: () => void;
}

function ApprovalActionModal({ request, opened, onClose }: ApprovalActionModalProps) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<ApprovalDecision>('approved');
  const [comments, setComments] = useState('');

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      approveOrRejectRequest(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['approvalRequests'] });
      queryClient.invalidateQueries({ queryKey: ['savedGrants'] });
      notifications.show({
        title: 'Success',
        message: response.message || 'Request processed successfully',
        color: decision === 'approved' ? 'green' : 'orange',
      });
      setComments('');
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to process request',
        color: 'red',
      });
    },
  });

  const handleSubmit = () => {
    if (!request) return;

    if (decision === 'rejected' && !comments.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please provide a reason for rejection',
        color: 'orange',
      });
      return;
    }

    approveMutation.mutate({
      id: request.id,
      data: { decision, comments: comments.trim() || undefined },
    });
  };

  if (!request) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Review Approval Request"
      size="lg"
    >
      <Stack gap="md">
        <Card withBorder p="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Grant
              </Text>
              <Text fw={500}>{request.grant?.title || 'Unknown Grant'}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Transition
              </Text>
              <Group gap="xs">
                <Badge color={getStageColor(request.from_stage)}>{request.from_stage}</Badge>
                <IconChevronRight size={14} />
                <Badge color={getStageColor(request.to_stage)}>{request.to_stage}</Badge>
              </Group>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Requested By
              </Text>
              <Group gap="xs">
                <Avatar size="sm" radius="xl">
                  {request.requester?.full_name?.charAt(0) || 'U'}
                </Avatar>
                <Text size="sm">{request.requester?.full_name || 'Unknown User'}</Text>
              </Group>
            </Group>
            {request.request_notes && (
              <Box>
                <Text size="sm" c="dimmed" mb={4}>
                  Request Notes
                </Text>
                <Text size="sm" p="xs" style={{ background: '#f8f9fa', borderRadius: '4px' }}>
                  {request.request_notes}
                </Text>
              </Box>
            )}
          </Stack>
        </Card>

        <Tabs defaultValue="approve">
          <Tabs.List>
            <Tabs.Tab value="approve" leftSection={<IconCheck size={16} />}>
              Approve
            </Tabs.Tab>
            <Tabs.Tab value="reject" leftSection={<IconX size={16} />} color="red">
              Reject
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="approve" pt="md">
            <Stack gap="md">
              <Alert color="green" variant="light">
                Approving this request will advance it to the next approval level or complete the
                approval process.
              </Alert>
              <Textarea
                label="Comments (Optional)"
                placeholder="Add any comments about your approval..."
                value={decision === 'approved' ? comments : ''}
                onChange={(e) => {
                  setDecision('approved');
                  setComments(e.target.value);
                }}
                rows={3}
              />
              <Button
                color="green"
                fullWidth
                leftSection={<IconCheck size={16} />}
                onClick={handleSubmit}
                loading={approveMutation.isPending}
              >
                Approve Request
              </Button>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="reject" pt="md">
            <Stack gap="md">
              <Alert color="red" variant="light">
                Rejecting this request will cancel the stage transition. The grant will remain in
                its current stage.
              </Alert>
              <Textarea
                label="Rejection Reason (Required)"
                placeholder="Please explain why you're rejecting this request..."
                value={decision === 'rejected' ? comments : ''}
                onChange={(e) => {
                  setDecision('rejected');
                  setComments(e.target.value);
                }}
                rows={3}
                required
              />
              <Button
                color="red"
                fullWidth
                leftSection={<IconX size={16} />}
                onClick={handleSubmit}
                loading={approveMutation.isPending}
              >
                Reject Request
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface ApprovalRequestCardProps {
  request: ApprovalRequest;
  canApprove: boolean;
  onAction: (request: ApprovalRequest) => void;
}

function ApprovalRequestCard({ request, canApprove, onAction }: ApprovalRequestCardProps) {
  const expired = isRequestExpired(request);
  const progress = getApprovalProgress(request);

  const statusColor =
    request.status === 'approved'
      ? 'green'
      : request.status === 'rejected'
      ? 'red'
      : expired
      ? 'gray'
      : 'blue';

  return (
    <Card withBorder p="md" style={{ opacity: expired ? 0.6 : 1 }}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <IconFileText size={20} />
            <div style={{ flex: 1 }}>
              <Text fw={500} size="sm">
                {request.grant?.title || 'Unknown Grant'}
              </Text>
              <Text size="xs" c="dimmed">
                {formatTransitionLabel(request.from_stage, request.to_stage)}
              </Text>
            </div>
          </Group>
          <Badge color={statusColor} variant="light">
            {expired ? 'Expired' : request.status}
          </Badge>
        </Group>

        {request.status === 'pending' && !expired && (
          <Box>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">
                Approval Progress
              </Text>
              <Text size="xs" c="dimmed">
                Level {progress.currentLevel} of {progress.totalLevels}
              </Text>
            </Group>
            <Progress
              value={(progress.currentLevelApprovals / progress.currentLevelRequired) * 100}
              color="violet"
              size="sm"
            />
            <Text size="xs" c="dimmed" mt={4}>
              {progress.currentLevelApprovals} of {progress.currentLevelRequired} approvals at
              current level
            </Text>
          </Box>
        )}

        <Group gap="xs">
          <Avatar size="sm" radius="xl">
            {request.requester?.full_name?.charAt(0) || 'U'}
          </Avatar>
          <div>
            <Text size="xs" c="dimmed">
              Requested by
            </Text>
            <Text size="xs">{request.requester?.full_name || 'Unknown User'}</Text>
          </div>
          <Box style={{ marginLeft: 'auto' }}>
            <Text size="xs" c="dimmed">
              {new Date(request.requested_at).toLocaleDateString()}
            </Text>
          </Box>
        </Group>

        {request.request_notes && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {request.request_notes}
          </Text>
        )}

        {canApprove && !expired && request.status === 'pending' && (
          <Button
            fullWidth
            variant="light"
            color="violet"
            onClick={() => onAction(request)}
            leftSection={<IconCheck size={16} />}
          >
            Review Request
          </Button>
        )}

        {request.status === 'rejected' && request.rejection_reason && (
          <Alert color="red" variant="light" icon={<IconX size={16} />}>
            <Text size="xs" fw={500} mb={4}>
              Rejection Reason:
            </Text>
            <Text size="xs">{request.rejection_reason}</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}

export function PendingApprovalsList() {
  const { currentOrg } = useOrganization();
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('pending');

  // Fetch all approval requests
  const { data: allRequests, isLoading: loadingAll } = useQuery({
    queryKey: ['approvalRequests', currentOrg?.id, 'all'],
    queryFn: () =>
      fetchApprovalRequests({
        orgId: currentOrg!.id,
      }),
    enabled: !!currentOrg?.id,
  });

  // Fetch pending approvals for current user
  const { data: myPendingRequests, isLoading: loadingMine } = useQuery({
    queryKey: ['approvalRequests', currentOrg?.id, 'mine'],
    queryFn: () =>
      fetchApprovalRequests({
        orgId: currentOrg!.id,
        pendingForUser: true,
      }),
    enabled: !!currentOrg?.id,
  });

  const handleOpenModal = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setModalOpened(true);
  };

  const handleCloseModal = () => {
    setModalOpened(false);
    setSelectedRequest(null);
  };

  if (!currentOrg) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Please select an organization to view approval requests.
      </Alert>
    );
  }

  const pendingRequests = allRequests?.filter((r) => r.status === 'pending') || [];
  const completedRequests = allRequests?.filter((r) => r.status !== 'pending') || [];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text size="lg" fw={600}>
            Approval Requests
          </Text>
          <Text size="sm" c="dimmed">
            View and manage grant stage transition approvals
          </Text>
        </div>
        {myPendingRequests && myPendingRequests.length > 0 && (
          <Badge size="lg" color="violet" variant="filled">
            {myPendingRequests.length} pending your review
          </Badge>
        )}
      </Group>

      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'pending')}>
        <Tabs.List>
          <Tabs.Tab
            value="pending"
            leftSection={<IconClock size={16} />}
            rightSection={
              <Badge size="sm" variant="filled" color="blue">
                {pendingRequests.length}
              </Badge>
            }
          >
            Pending
          </Tabs.Tab>
          <Tabs.Tab
            value="mine"
            leftSection={<IconUser size={16} />}
            rightSection={
              myPendingRequests && myPendingRequests.length > 0 ? (
                <Badge size="sm" variant="filled" color="violet">
                  {myPendingRequests.length}
                </Badge>
              ) : undefined
            }
          >
            My Approvals
          </Tabs.Tab>
          <Tabs.Tab value="completed" leftSection={<IconCheck size={16} />}>
            Completed
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="pending" pt="md">
          {loadingAll ? (
            <Text>Loading requests...</Text>
          ) : pendingRequests.length > 0 ? (
            <Stack gap="md">
              {pendingRequests.map((request) => {
                const canApprove =
                  myPendingRequests?.some((r) => r.id === request.id) || false;
                return (
                  <ApprovalRequestCard
                    key={request.id}
                    request={request}
                    canApprove={canApprove}
                    onAction={handleOpenModal}
                  />
                );
              })}
            </Stack>
          ) : (
            <Alert icon={<IconCheck size={16} />} color="green">
              No pending approval requests. All caught up!
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="mine" pt="md">
          {loadingMine ? (
            <Text>Loading your approvals...</Text>
          ) : myPendingRequests && myPendingRequests.length > 0 ? (
            <Stack gap="md">
              {myPendingRequests.map((request) => (
                <ApprovalRequestCard
                  key={request.id}
                  request={request}
                  canApprove={true}
                  onAction={handleOpenModal}
                />
              ))}
            </Stack>
          ) : (
            <Alert icon={<IconCheck size={16} />} color="green">
              No approvals pending your review. All caught up!
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="completed" pt="md">
          {loadingAll ? (
            <Text>Loading requests...</Text>
          ) : completedRequests.length > 0 ? (
            <Stack gap="md">
              {completedRequests.map((request) => (
                <ApprovalRequestCard
                  key={request.id}
                  request={request}
                  canApprove={false}
                  onAction={handleOpenModal}
                />
              ))}
            </Stack>
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              No completed approval requests yet.
            </Alert>
          )}
        </Tabs.Panel>
      </Tabs>

      <ApprovalActionModal
        request={selectedRequest}
        opened={modalOpened}
        onClose={handleCloseModal}
      />
    </Stack>
  );
}
