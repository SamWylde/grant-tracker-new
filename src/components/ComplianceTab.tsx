import { Stack, Text, Group, Badge, Paper, Alert, Progress, Checkbox, Accordion, Divider } from "@mantine/core";
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconShieldCheck,
  IconAlertTriangle,
  IconExternalLink,
  IconFileText,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface ComplianceTabProps {
  grantId: string;
  orgId?: string; // Optional, not currently used but may be needed for future access control
}

interface ComplianceSummary {
  total_requirements: number;
  completed_requirements: number;
  critical_requirements: number;
  critical_completed: number;
  compliance_percent: number;
  upcoming_due: number;
  overdue: number;
}

interface ComplianceRequirement {
  id: string;
  requirement_type: string;
  title: string;
  description: string | null;
  regulation_reference: string | null;
  policy_url: string | null;
  due_date: string | null;
  reminder_days_before: number;
  documentation_required: boolean;
  is_critical: boolean;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  status: string;
  notes: string | null;
}

export function ComplianceTab({ grantId }: ComplianceTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['compliance', grantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`/api/compliance?grant_id=${grantId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch compliance requirements');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">Loading compliance requirements...</Text>
      </Stack>
    );
  }

  if (error || !data) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">No compliance requirements have been defined for this grant yet.</Text>
      </Alert>
    );
  }

  const requirements: ComplianceRequirement[] = data.requirements || [];
  const summary: ComplianceSummary = data.summary || {
    total_requirements: requirements.length,
    completed_requirements: requirements.filter(r => r.completed).length,
    critical_requirements: requirements.filter(r => r.is_critical).length,
    critical_completed: requirements.filter(r => r.is_critical && r.completed).length,
    compliance_percent: 0,
    upcoming_due: 0,
    overdue: 0,
  };

  const typeLabels: Record<string, { label: string; icon: any; color: string }> = {
    federal_regulation: { label: 'Federal Regulation', icon: IconShieldCheck, color: 'blue' },
    state_regulation: { label: 'State Regulation', icon: IconShieldCheck, color: 'cyan' },
    indirect_cost_agreement: { label: 'Indirect Cost Agreement', icon: IconFileText, color: 'grape' },
    match_requirement: { label: 'Match Requirement', icon: IconFileText, color: 'green' },
    audit_requirement: { label: 'Audit Requirement', icon: IconFileText, color: 'orange' },
    reporting_requirement: { label: 'Reporting Requirement', icon: IconFileText, color: 'teal' },
    certification: { label: 'Certification', icon: IconCheck, color: 'indigo' },
    policy: { label: 'Policy Compliance', icon: IconFileText, color: 'violet' },
    other: { label: 'Other', icon: IconFileText, color: 'gray' },
  };

  const getRequirementStatus = (req: ComplianceRequirement) => {
    if (req.completed) return { color: 'green', label: 'Completed', icon: IconCheck };

    if (req.due_date) {
      const daysUntil = dayjs(req.due_date).diff(dayjs(), 'days');
      if (daysUntil < 0) return { color: 'red', label: 'Overdue', icon: IconAlertTriangle };
      if (daysUntil <= 14) return { color: 'yellow', label: 'Due Soon', icon: IconCalendar };
    }

    return { color: 'blue', label: 'In Progress', icon: IconFileText };
  };

  // Group requirements by type
  const groupedRequirements = requirements.reduce((acc, req) => {
    if (!acc[req.requirement_type]) {
      acc[req.requirement_type] = [];
    }
    acc[req.requirement_type].push(req);
    return acc;
  }, {} as Record<string, ComplianceRequirement[]>);

  const criticalRequirements = requirements.filter(r => r.is_critical && !r.completed);
  const overdueRequirements = requirements.filter(r => {
    if (r.completed || !r.due_date) return false;
    return dayjs(r.due_date).diff(dayjs(), 'days') < 0;
  });

  return (
    <Stack gap="lg">
      {/* Compliance Completeness Bar */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconShieldCheck size={24} color="var(--mantine-color-blue-6)" />
            <div>
              <Text size="sm" fw={600}>Compliance Status</Text>
              <Text size="xs" c="dimmed">
                {summary.completed_requirements} of {summary.total_requirements} requirements completed
              </Text>
            </div>
          </Group>
          <Text size="xl" fw={700} c={summary.compliance_percent >= 100 ? 'green' : 'blue'}>
            {summary.compliance_percent.toFixed(0)}%
          </Text>
        </Group>

        <Progress.Root size="xl">
          <Progress.Section
            value={summary.compliance_percent}
            color={summary.compliance_percent >= 100 ? 'green' : summary.compliance_percent >= 75 ? 'blue' : 'yellow'}
          >
            <Progress.Label>{summary.compliance_percent.toFixed(0)}%</Progress.Label>
          </Progress.Section>
        </Progress.Root>

        {summary.critical_requirements > 0 && (
          <Group justify="space-between" mt="md" p="xs" style={{
            backgroundColor: 'var(--mantine-color-red-0)',
            borderRadius: 'var(--mantine-radius-sm)'
          }}>
            <Group gap="xs">
              <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
              <Text size="xs" fw={600}>Critical Requirements</Text>
            </Group>
            <Text size="xs" fw={600}>
              {summary.critical_completed} / {summary.critical_requirements} Complete
            </Text>
          </Group>
        )}
      </Paper>

      {/* Alerts */}
      {overdueRequirements.length > 0 && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          <Text size="sm" fw={600} mb={4}>
            {overdueRequirements.length} Overdue Requirement{overdueRequirements.length > 1 ? 's' : ''}
          </Text>
          <Text size="xs">
            Immediate action required. Review overdue compliance requirements below.
          </Text>
        </Alert>
      )}

      {criticalRequirements.length > 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
          <Text size="sm" fw={600} mb={4}>
            {criticalRequirements.length} Critical Requirement{criticalRequirements.length > 1 ? 's' : ''} Pending
          </Text>
          <Text size="xs">
            These requirements are marked as critical and must be completed to maintain compliance.
          </Text>
        </Alert>
      )}

      {/* Critical Requirements Section */}
      {criticalRequirements.length > 0 && (
        <>
          <div>
            <Group mb="md">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text size="sm" fw={600}>Critical Requirements</Text>
            </Group>

            <Stack gap="sm">
              {criticalRequirements.map((req) => {
                const status = getRequirementStatus(req);
                const typeInfo = typeLabels[req.requirement_type] || typeLabels.other;

                return (
                  <Paper key={req.id} p="md" withBorder style={{
                    backgroundColor: 'var(--mantine-color-red-0)',
                    borderLeft: `4px solid var(--mantine-color-red-6)`
                  }}>
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs" style={{ flex: 1 }}>
                        <Badge color="red" variant="filled" size="sm">CRITICAL</Badge>
                        <Badge color={typeInfo.color} variant="light" size="sm">
                          {typeInfo.label}
                        </Badge>
                        <Badge color={status.color} variant="light" size="sm">
                          {status.label}
                        </Badge>
                      </Group>
                    </Group>

                    <Text size="sm" fw={600} mb="xs">{req.title}</Text>

                    {req.description && (
                      <Text size="xs" c="dimmed" mb="xs">{req.description}</Text>
                    )}

                    {req.due_date && (
                      <Group gap={6} mt="xs">
                        <IconCalendar size={14} />
                        <Text size="xs" c="dimmed">
                          Due: {dayjs(req.due_date).format('MMM D, YYYY')}
                          {' '}({dayjs(req.due_date).fromNow()})
                        </Text>
                      </Group>
                    )}

                    {req.regulation_reference && (
                      <Text size="xs" c="dimmed" mt="xs">
                        Reference: {req.regulation_reference}
                      </Text>
                    )}

                    {req.policy_url && (
                      <Group gap={4} mt="xs">
                        <IconExternalLink size={14} />
                        <Text
                          size="xs"
                          component="a"
                          href={req.policy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          c="blue"
                          style={{ textDecoration: 'underline' }}
                        >
                          View Policy
                        </Text>
                      </Group>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </div>
          <Divider />
        </>
      )}

      {/* Requirements by Type */}
      <div>
        <Text size="sm" fw={600} mb="md">All Requirements</Text>

        <Accordion variant="separated">
          {Object.entries(groupedRequirements).map(([type, reqs]) => {
            const typeInfo = typeLabels[type] || typeLabels.other;
            const completed = reqs.filter(r => r.completed).length;
            const total = reqs.length;
            const percentComplete = (completed / total) * 100;

            return (
              <Accordion.Item key={type} value={type}>
                <Accordion.Control icon={<typeInfo.icon size={20} />}>
                  <Group justify="space-between" style={{ paddingRight: 16 }}>
                    <div>
                      <Text size="sm" fw={600}>{typeInfo.label}</Text>
                      <Text size="xs" c="dimmed">{completed} of {total} completed</Text>
                    </div>
                    <Progress
                      value={percentComplete}
                      size="sm"
                      color={percentComplete === 100 ? 'green' : 'blue'}
                      style={{ width: 100 }}
                    />
                  </Group>
                </Accordion.Control>

                <Accordion.Panel>
                  <Stack gap="sm">
                    {reqs.map((req) => {
                      const status = getRequirementStatus(req);

                      return (
                        <Paper key={req.id} p="sm" withBorder style={{
                          backgroundColor: req.completed ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-gray-0)'
                        }}>
                          <Group justify="space-between" mb="xs">
                            <Group gap="xs" style={{ flex: 1 }}>
                              <Checkbox checked={req.completed} readOnly />
                              <Text size="sm" fw={500} style={{
                                textDecoration: req.completed ? 'line-through' : 'none'
                              }}>
                                {req.title}
                              </Text>
                            </Group>
                            <Badge color={status.color} variant="light" size="sm">
                              {status.label}
                            </Badge>
                          </Group>

                          {req.description && (
                            <Text size="xs" c="dimmed" ml={28}>{req.description}</Text>
                          )}

                          <Group gap="md" ml={28} mt="xs">
                            {req.due_date && (
                              <Group gap={4}>
                                <IconCalendar size={12} />
                                <Text size="xs" c="dimmed">
                                  {dayjs(req.due_date).format('MMM D, YYYY')}
                                </Text>
                              </Group>
                            )}

                            {req.documentation_required && (
                              <Badge size="xs" variant="outline" color="blue">
                                Documentation Required
                              </Badge>
                            )}

                            {req.is_critical && (
                              <Badge size="xs" variant="outline" color="red">
                                Critical
                              </Badge>
                            )}
                          </Group>

                          {req.completed && req.completed_at && (
                            <Text size="xs" c="dimmed" ml={28} mt="xs" style={{ fontStyle: 'italic' }}>
                              Completed {dayjs(req.completed_at).format('MMM D, YYYY')}
                            </Text>
                          )}

                          {req.regulation_reference && (
                            <Text size="xs" c="dimmed" ml={28} mt="xs">
                              Ref: {req.regulation_reference}
                            </Text>
                          )}

                          {req.policy_url && (
                            <Group gap={4} ml={28} mt="xs">
                              <IconExternalLink size={12} />
                              <Text
                                size="xs"
                                component="a"
                                href={req.policy_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                c="blue"
                                style={{ textDecoration: 'underline' }}
                              >
                                View Policy Document
                              </Text>
                            </Group>
                          )}

                          {req.notes && (
                            <Text size="xs" c="dimmed" ml={28} mt="xs" style={{ fontStyle: 'italic' }}>
                              Note: {req.notes}
                            </Text>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </div>

      {requirements.length === 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
          <Text size="sm">No compliance requirements have been defined yet. Add requirements to track compliance obligations for this grant.</Text>
        </Alert>
      )}
    </Stack>
  );
}
