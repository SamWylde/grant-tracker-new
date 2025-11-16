import { ActionIcon, Tooltip, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

interface DarkModeToggleProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function DarkModeToggle({ size = 'md' }: DarkModeToggleProps) {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tooltip label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} position="bottom">
      <ActionIcon
        onClick={() => toggleColorScheme()}
        size={size}
        variant="subtle"
        color="gray"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? (
          <IconSun size={18} aria-hidden="true" />
        ) : (
          <IconMoon size={18} aria-hidden="true" />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
