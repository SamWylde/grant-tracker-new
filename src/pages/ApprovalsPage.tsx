import { Container, Title, Text, Stack } from '@mantine/core';
import { PendingApprovalsList } from '../components/PendingApprovalsList';

export function ApprovalsPage() {
  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={1}>Approvals</Title>
          <Text c="dimmed" mt="sm">
            Review and manage approval requests for grant stage transitions. Approve or reject
            requests to control your grant workflow.
          </Text>
        </div>

        <PendingApprovalsList />
      </Stack>
    </Container>
  );
}
