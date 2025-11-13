import { Textarea, Menu, Text, Avatar, Group, Stack } from "@mantine/core";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useOrganization } from "../contexts/OrganizationContext";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  autosize?: boolean;
  onMentionAdded?: (userId: string, userName: string) => void;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder = "Type @ to mention someone...",
  minRows = 4,
  autosize = true,
  onMentionAdded,
}: MentionTextareaProps) {
  const { currentOrg } = useOrganization();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch team members
  const { data: teamMembers } = useQuery({
    queryKey: ["teamMembers", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];

      const { data, error } = await (supabase.rpc as any)("get_org_team_members", {
        org_uuid: currentOrg.id,
      });

      if (error) {
        console.error("Failed to fetch team members:", error);
        return [];
      }

      return (data || []) as TeamMember[];
    },
    enabled: !!currentOrg,
  });

  // Filter team members based on search
  const filteredMembers = teamMembers?.filter((member) =>
    member.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
    member.email?.toLowerCase().includes(mentionSearch.toLowerCase())
  ) || [];

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check if @ was typed
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's no space after @ (means we're still typing the mention)
      if (!textAfterAt.includes(" ") && textAfterAt.length >= 0) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  // Handle mention selection
  const handleMentionSelect = (member: TeamMember) => {
    if (!textareaRef.current) return;

    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const displayName = member.full_name || member.email || 'Unknown User';
      const newValue =
        value.substring(0, lastAtIndex) +
        `@${displayName} ` +
        textAfterCursor;

      onChange(newValue);
      setShowMentions(false);
      setMentionSearch("");

      // Notify parent about mention
      if (onMentionAdded) {
        onMentionAdded(member.user_id, displayName);
      }

      // Restore focus and cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastAtIndex + displayName.length + 2; // +2 for @ and space
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  // Handle keyboard navigation in mention menu
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "Escape") {
        setShowMentions(false);
        e.preventDefault();
      }
      // Could add arrow key navigation here if needed
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ position: "relative" }}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        minRows={minRows}
        autosize={autosize}
      />

      {showMentions && filteredMembers.length > 0 && (
        <Menu opened={showMentions} position="bottom-start" width={300}>
          <Menu.Dropdown
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              marginBottom: 4,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            <Menu.Label>Mention team member</Menu.Label>
            {filteredMembers.map((member) => (
              <Menu.Item
                key={member.user_id}
                onClick={() => handleMentionSelect(member)}
              >
                <Group gap="sm">
                  <Avatar size="sm" radius="xl" color="grape">
                    {getInitials(member.full_name || "U")}
                  </Avatar>
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {member.full_name || "Unknown"}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {member.email}
                    </Text>
                  </Stack>
                </Group>
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
}
