import { Container, Paper } from '@mantine/core';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { EligibilityWizard } from '../components/EligibilityWizard';

export function EligibilityWizardPage() {
  return (
    <ProtectedRoute>
      <Container size="lg" py="xl">
        <Paper p="xl" radius="md">
          <EligibilityWizard />
        </Paper>
      </Container>
    </ProtectedRoute>
  );
}
