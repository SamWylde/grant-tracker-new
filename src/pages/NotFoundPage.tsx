import { Container, Title, Text, Button, Stack, Box } from "@mantine/core";
import { Link } from "react-router-dom";
import { IconArrowLeft, IconHome } from "@tabler/icons-react";

export default function NotFoundPage() {
  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Container size="sm">
        <Stack gap="xl" align="center" style={{ textAlign: "center" }}>
          {/* 404 Display */}
          <Title
            order={1}
            style={{
              fontSize: "120px",
              fontWeight: 900,
              color: "white",
              textShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
              lineHeight: 1,
            }}
          >
            404
          </Title>

          {/* Message */}
          <Stack gap="md" align="center">
            <Title order={2} c="white" fw={600}>
              Page Not Found
            </Title>
            <Text size="lg" c="rgba(255, 255, 255, 0.9)">
              Sorry, we couldn't find the page you're looking for. It might have been
              moved or doesn't exist.
            </Text>
          </Stack>

          {/* Action Buttons */}
          <Stack gap="sm" align="center" mt="md">
            <Button
              component={Link}
              to="/"
              size="lg"
              variant="white"
              color="grape"
              leftSection={<IconHome size={20} />}
              style={{
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
              }}
            >
              Go to Home
            </Button>
            <Button
              component={Link}
              to="/discover"
              variant="subtle"
              c="white"
              leftSection={<IconArrowLeft size={18} />}
            >
              Browse Grants
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
