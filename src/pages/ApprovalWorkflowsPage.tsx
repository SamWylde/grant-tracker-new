import { Container, Title, Text, Stack } from '@mantine/core';
import { ApprovalWorkflowManager } from '../components/ApprovalWorkflowManager';

export function ApprovalWorkflowsPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1}>Approval Workflows</Title>
          <Text c="dimmed" mt="sm">
            Configure approval requirements for grant stage transitions. Set up multi-level approval
            chains to ensure proper oversight before grants move between stages.
          </Text>
        </div>

        <ApprovalWorkflowManager />
      </Stack>
    </Container>
  );
}
