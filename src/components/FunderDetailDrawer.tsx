import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  Tabs,
  Loader,
  Box,
  Divider,
  Anchor,
} from "@mantine/core";
import {
  IconExternalLink,
  IconBuilding,
  IconUsers,
  IconFileText,
  IconMessage,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../contexts/OrganizationContext";
import { ContactsSection } from "./ContactsSection";
import { FunderInteractionsLog } from "./FunderInteractionsLog";
import { Link } from "react-router-dom";

interface FunderDetailDrawerProps {
  funderId: string | null;
  opened: boolean;
  onClose: () => void;
}

interface Funder {
  id: string;
  org_id: string;
  name: string;
  website: string | null;
  description: string | null;
  agency_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts: Array<{ count: number }>;
  grants: Array<{ count: number }>;
  interactions: Array<{ count: number }>;
}

interface Grant {
  id: string;
  title: string;
  status: string;
  close_date: string | null;
}

export function FunderDetailDrawer({ funderId, opened, onClose }: FunderDetailDrawerProps) {
  const { currentOrg } = useOrganization();

  // Fetch funder details
  const { data: funder, isLoading } = useQuery<Funder>({
    queryKey: ["funder", funderId],
    queryFn: async () => {
      if (!funderId || !currentOrg?.id) throw new Error("Missing required data");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/funders?org_id=${currentOrg.id}&id=${funderId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch funder");
      }

      const result = await response.json();
      return result.funder;
    },
    enabled: !!funderId && !!currentOrg?.id && opened,
  });

  // Fetch related grants
  const { data: grants } = useQuery<Grant[]>({
    queryKey: ["funder-grants", funderId],
    queryFn: async () => {
      if (!funderId || !currentOrg?.id) throw new Error("Missing required data");

      const { data, error } = await supabase
        .from("org_grants_saved")
        .select("id, title, status, close_date")
        .eq("org_id", currentOrg.id)
        .eq("funder_id", funderId)
        .order("close_date", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!funderId && !!currentOrg?.id && opened,
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="sm">
          <IconBuilding size={24} />
          <Text fw={600} size="lg">
            {funder?.name || "Funder Details"}
          </Text>
        </Group>
      }
    >
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : funder ? (
        <Stack gap="lg">
          {/* Header Info */}
          <Box>
            <Group gap="sm" mb="md">
              {funder.agency_code && (
                <Badge variant="light" color="blue">
                  {funder.agency_code}
                </Badge>
              )}
              {funder.website && (
                <Anchor href={funder.website} target="_blank" rel="noopener noreferrer" size="sm">
                  <Group gap={4}>
                    Visit Website
                    <IconExternalLink size={14} />
                  </Group>
                </Anchor>
              )}
            </Group>

            {funder.description && (
              <Text size="sm" c="dimmed" mb="md">
                {funder.description}
              </Text>
            )}

            <Group gap="lg">
              <Group gap="xs">
                <IconUsers size={16} style={{ opacity: 0.6 }} />
                <Text size="sm" c="dimmed">
                  {funder.contacts[0]?.count || 0} contacts
                </Text>
              </Group>
              <Group gap="xs">
                <IconFileText size={16} style={{ opacity: 0.6 }} />
                <Text size="sm" c="dimmed">
                  {funder.grants[0]?.count || 0} grants
                </Text>
              </Group>
              <Group gap="xs">
                <IconMessage size={16} style={{ opacity: 0.6 }} />
                <Text size="sm" c="dimmed">
                  {funder.interactions[0]?.count || 0} interactions
                </Text>
              </Group>
            </Group>

            {funder.notes && (
              <>
                <Divider my="md" />
                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Internal Notes
                  </Text>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>
                    {funder.notes}
                  </Text>
                </Box>
              </>
            )}
          </Box>

          <Divider />

          {/* Tabs for different sections */}
          <Tabs defaultValue="contacts">
            <Tabs.List>
              <Tabs.Tab value="contacts" leftSection={<IconUsers size={16} />}>
                Contacts ({funder.contacts[0]?.count || 0})
              </Tabs.Tab>
              <Tabs.Tab value="grants" leftSection={<IconFileText size={16} />}>
                Grants ({funder.grants[0]?.count || 0})
              </Tabs.Tab>
              <Tabs.Tab value="interactions" leftSection={<IconMessage size={16} />}>
                Interactions ({funder.interactions[0]?.count || 0})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="contacts" pt="md">
              <ContactsSection funderId={funderId} />
            </Tabs.Panel>

            <Tabs.Panel value="grants" pt="md">
              <Stack gap="sm">
                {grants && grants.length > 0 ? (
                  grants.map((grant) => (
                    <Box
                      key={grant.id}
                      p="md"
                      style={(theme) => ({
                        border: `1px solid ${theme.colors.gray[3]}`,
                        borderRadius: theme.radius.md,
                      })}
                    >
                      <Group justify="space-between" align="flex-start">
                        <Box style={{ flex: 1 }}>
                          <Text
                            fw={500}
                            component={Link}
                            to={`/pipeline/${grant.id}`}
                            style={{ textDecoration: "none", color: "inherit" }}
                          >
                            {grant.title}
                          </Text>
                          {grant.close_date && (
                            <Text size="sm" c="dimmed">
                              Deadline: {new Date(grant.close_date).toLocaleDateString()}
                            </Text>
                          )}
                        </Box>
                        <Badge variant="light" color={getStatusColor(grant.status)}>
                          {grant.status}
                        </Badge>
                      </Group>
                    </Box>
                  ))
                ) : (
                  <Text c="dimmed" ta="center" py="md">
                    No grants linked to this funder yet
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="interactions" pt="md">
              <FunderInteractionsLog funderId={funderId} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      ) : (
        <Text c="dimmed" ta="center" py="xl">
          Funder not found
        </Text>
      )}
    </Drawer>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    researching: "blue",
    drafting: "yellow",
    submitted: "cyan",
    awarded: "green",
    rejected: "red",
    withdrawn: "gray",
  };
  return colors[status] || "gray";
}
