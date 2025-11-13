import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Alert,
  Switch,
  NumberInput,
  MultiSelect,
  Box,
  Text,
  Badge,
  ActionIcon,
  Card,
  Divider,
  Table,
  Menu,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconDotsVertical,
  IconSettings,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
} from '../utils/approvalsApi';
import type {
  ApprovalWorkflow,
  CreateWorkflowRequest,
  ApprovalLevel,
  GrantStage,
} from '../types/approvals';
import { GRANT_STAGES, formatTransitionLabel } from '../types/approvals';

interface WorkflowFormProps {
  opened: boolean;
  onClose: () => void;
  workflow?: ApprovalWorkflow | null;
}

function WorkflowForm({ opened, onClose, workflow }: WorkflowFormProps) {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();

  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [fromStage, setFromStage] = useState<GrantStage | null>(workflow?.from_stage || null);
  const [toStage, setToStage] = useState<GrantStage | null>(workflow?.to_stage || null);
  const [approvalChain, setApprovalChain] = useState<ApprovalLevel[]>(
    workflow?.approval_chain || [{ level: 1, role: 'admin', required_approvers: 1 }]
  );
  const [requireAllLevels, setRequireAllLevels] = useState(workflow?.require_all_levels ?? true);
  const [allowSelfApproval, setAllowSelfApproval] = useState(workflow?.allow_self_approval ?? false);
  const [autoApproveAdmin, setAutoApproveAdmin] = useState(workflow?.auto_approve_admin ?? false);
  const [errors, setErrors] = useState<string[]>([]);

  // Fetch team members for specific user selection
  const { data: teamMembers } = useQuery({
    queryKey: ['teamMembers', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await (supabase.rpc as any)('get_org_team_members', {
        org_uuid: currentOrg.id,
      });
      if (error) throw error;
      return data?.map((member: any) => ({
        value: member.user_id,
        label: member.full_name || member.email || 'Unknown User',
      })) || [];
    },
    enabled: !!currentOrg?.id,
  });

  const createMutation = useMutation({
    mutationFn: createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] });
      notifications.show({
        title: 'Success',
        message: 'Approval workflow created successfully',
        color: 'green',
      });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create workflow',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] });
      notifications.show({
        title: 'Success',
        message: 'Approval workflow updated successfully',
        color: 'green',
      });
      onClose();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update workflow',
        color: 'red',
      });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setFromStage(null);
    setToStage(null);
    setApprovalChain([{ level: 1, role: 'admin', required_approvers: 1 }]);
    setRequireAllLevels(true);
    setAllowSelfApproval(false);
    setAutoApproveAdmin(false);
    setErrors([]);
  };

  const handleAddLevel = () => {
    const nextLevel = approvalChain.length + 1;
    setApprovalChain([
      ...approvalChain,
      { level: nextLevel, role: 'admin', required_approvers: 1 },
    ]);
  };

  const handleRemoveLevel = (level: number) => {
    const filtered = approvalChain.filter(l => l.level !== level);
    // Re-number levels
    const renumbered = filtered.map((l, idx) => ({ ...l, level: idx + 1 }));
    setApprovalChain(renumbered);
  };

  const handleUpdateLevel = (level: number, updates: Partial<ApprovalLevel>) => {
    setApprovalChain(
      approvalChain.map(l => (l.level === level ? { ...l, ...updates } : l))
    );
  };

  const handleSubmit = async () => {
    if (!currentOrg) {
      notifications.show({
        title: 'Error',
        message: 'No organization selected',
        color: 'red',
      });
      return;
    }

    // Validation
    const newErrors: string[] = [];
    if (!name.trim()) newErrors.push('Workflow name is required');
    if (!fromStage) newErrors.push('From stage is required');
    if (!toStage) newErrors.push('To stage is required');
    if (fromStage === toStage) newErrors.push('From and To stages must be different');
    if (approvalChain.length === 0) newErrors.push('At least one approval level is required');

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors([]);

    const workflowData: CreateWorkflowRequest = {
      org_id: currentOrg.id,
      name,
      description,
      from_stage: fromStage!,
      to_stage: toStage!,
      approval_chain: approvalChain,
      require_all_levels: requireAllLevels,
      allow_self_approval: allowSelfApproval,
      auto_approve_admin: autoApproveAdmin,
    };

    if (workflow) {
      updateMutation.mutate({ id: workflow.id, data: workflowData });
    } else {
      createMutation.mutate(workflowData);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={workflow ? 'Edit Approval Workflow' : 'Create Approval Workflow'}
      size="xl"
    >
      <Stack gap="md">
        {errors.length > 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Validation Errors">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <TextInput
          label="Workflow Name"
          placeholder="e.g., Director Approval for Submission"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Textarea
          label="Description"
          placeholder="Describe when this workflow applies..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Group grow>
          <Select
            label="From Stage"
            placeholder="Select starting stage"
            data={GRANT_STAGES}
            value={fromStage}
            onChange={(val) => setFromStage(val as GrantStage)}
            required
          />
          <Select
            label="To Stage"
            placeholder="Select target stage"
            data={GRANT_STAGES}
            value={toStage}
            onChange={(val) => setToStage(val as GrantStage)}
            required
          />
        </Group>

        <Divider label="Approval Levels" labelPosition="center" />

        {approvalChain.map((level, idx) => (
          <Card key={level.level} withBorder p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Badge color="violet" size="lg">
                  Level {level.level}
                </Badge>
                {approvalChain.length > 1 && (
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveLevel(level.level)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>

              <Group grow>
                <Select
                  label="Approver Role"
                  data={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'contributor', label: 'Contributor' },
                    { value: 'specific', label: 'Specific Users' },
                  ]}
                  value={level.specific_users && level.specific_users.length > 0 ? 'specific' : level.role}
                  onChange={(val) => {
                    if (val === 'specific') {
                      handleUpdateLevel(level.level, { role: undefined, specific_users: [] });
                    } else {
                      handleUpdateLevel(level.level, {
                        role: val as 'admin' | 'contributor',
                        specific_users: undefined,
                      });
                    }
                  }}
                />

                <NumberInput
                  label="Required Approvers"
                  min={1}
                  value={level.required_approvers}
                  onChange={(val) =>
                    handleUpdateLevel(level.level, { required_approvers: Number(val) || 1 })
                  }
                />
              </Group>

              {level.specific_users !== undefined && (
                <MultiSelect
                  label="Specific Users"
                  placeholder="Select users who can approve"
                  data={teamMembers || []}
                  value={level.specific_users || []}
                  onChange={(val) => handleUpdateLevel(level.level, { specific_users: val })}
                  searchable
                />
              )}
            </Stack>
          </Card>
        ))}

        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={handleAddLevel}
        >
          Add Approval Level
        </Button>

        <Divider label="Advanced Settings" labelPosition="center" />

        <Switch
          label="Require All Levels"
          description="If disabled, approval at any level will approve the request"
          checked={requireAllLevels}
          onChange={(e) => setRequireAllLevels(e.currentTarget.checked)}
        />

        <Switch
          label="Allow Self-Approval"
          description="Allow the requester to approve their own request"
          checked={allowSelfApproval}
          onChange={(e) => setAllowSelfApproval(e.currentTarget.checked)}
        />

        <Switch
          label="Auto-Approve for Admins"
          description="Admins can bypass this approval workflow"
          checked={autoApproveAdmin}
          onChange={(e) => setAutoApproveAdmin(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            {workflow ? 'Update Workflow' : 'Create Workflow'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ApprovalWorkflowManager() {
  const { currentOrg } = useOrganization();
  const queryClient = useQueryClient();
  const [formOpened, setFormOpened] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['approvalWorkflows', currentOrg?.id],
    queryFn: () => fetchWorkflows(currentOrg!.id, false),
    enabled: !!currentOrg?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] });
      notifications.show({
        title: 'Success',
        message: 'Workflow deleted successfully',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to delete workflow',
        color: 'red',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateWorkflow(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvalWorkflows'] });
      notifications.show({
        title: 'Success',
        message: 'Workflow status updated',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update workflow',
        color: 'red',
      });
    },
  });

  const handleEdit = (workflow: ApprovalWorkflow) => {
    setEditingWorkflow(workflow);
    setFormOpened(true);
  };

  const handleCloseForm = () => {
    setFormOpened(false);
    setEditingWorkflow(null);
  };

  if (!currentOrg) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Please select an organization to manage approval workflows.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text size="lg" fw={600}>
            Approval Workflows
          </Text>
          <Text size="sm" c="dimmed">
            Configure approval requirements for grant stage transitions
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setFormOpened(true)}>
          Create Workflow
        </Button>
      </Group>

      {isLoading ? (
        <Text>Loading workflows...</Text>
      ) : workflows && workflows.length > 0 ? (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Transition</Table.Th>
              <Table.Th>Approval Levels</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {workflows.map((workflow) => (
              <Table.Tr key={workflow.id}>
                <Table.Td>
                  <div>
                    <Text fw={500}>{workflow.name}</Text>
                    {workflow.description && (
                      <Text size="xs" c="dimmed">
                        {workflow.description}
                      </Text>
                    )}
                  </div>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatTransitionLabel(workflow.from_stage, workflow.to_stage)}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light">{workflow.approval_chain.length} level(s)</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={workflow.is_active ? 'green' : 'gray'}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="subtle"
                      color={workflow.is_active ? 'gray' : 'green'}
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: workflow.id,
                          isActive: !workflow.is_active,
                        })
                      }
                    >
                      {workflow.is_active ? <IconX size={16} /> : <IconCheck size={16} />}
                    </ActionIcon>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleEdit(workflow)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Are you sure you want to delete this workflow? This cannot be undone.'
                              )
                            ) {
                              deleteMutation.mutate(workflow.id);
                            }
                          }}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Alert icon={<IconSettings size={16} />} color="blue">
          No approval workflows configured yet. Create your first workflow to require approvals for
          stage transitions.
        </Alert>
      )}

      <WorkflowForm opened={formOpened} onClose={handleCloseForm} workflow={editingWorkflow} />
    </Stack>
  );
}
