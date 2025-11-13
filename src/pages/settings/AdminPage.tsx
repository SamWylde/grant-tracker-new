import { Tabs } from '@mantine/core';
import { IconApi, IconUserCog, IconBuilding } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SettingsLayout } from '../../components/SettingsLayout';
import { AccessDenied } from '../../components/ProtectedRoute';
import { usePermission } from '../../hooks/usePermission';
import { APITestingPage } from './APITestingPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminOrganizationsPage } from './AdminOrganizationsPage';

export function AdminPage() {
  const { isPlatformAdmin } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  // Get the current tab from URL hash or default to 'api-testing'
  const hash = location.hash.replace('#', '');
  const activeTab = hash || 'api-testing';

  // Permission check - only platform admins can access this page
  if (!isPlatformAdmin) {
    return <AccessDenied />;
  }

  const handleTabChange = (value: string | null) => {
    if (value) {
      navigate(`/settings/admin#${value}`);
    }
  };

  return (
    <SettingsLayout>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="api-testing" leftSection={<IconApi size={16} />}>
            API Testing
          </Tabs.Tab>
          <Tabs.Tab value="user-management" leftSection={<IconUserCog size={16} />}>
            User Management
          </Tabs.Tab>
          <Tabs.Tab value="organizations" leftSection={<IconBuilding size={16} />}>
            Organizations
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="api-testing" pt="lg">
          <APITestingPage />
        </Tabs.Panel>

        <Tabs.Panel value="user-management" pt="lg">
          <AdminUsersPage />
        </Tabs.Panel>

        <Tabs.Panel value="organizations" pt="lg">
          <AdminOrganizationsPage />
        </Tabs.Panel>
      </Tabs>
    </SettingsLayout>
  );
}
