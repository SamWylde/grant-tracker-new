import { useState, useEffect, useRef } from "react";
import { Textarea, Button, Group, Paper, Text, Stack, Popover, ScrollArea, Avatar } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { supabase } from "../lib/supabase";

interface OrgMember {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  email?: string;
}

interface CommentInputProps {
  grantId?: string;
  taskId?: string;
  orgId: string;
  parentCommentId?: string;
  parentCommentAuthor?: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function CommentInput({
  grantId,
  taskId,
  orgId,
  parentCommentId,
  parentCommentAuthor,
  onSuccess,
  onCancel,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = content.length;
  const characterLimit = 10000;
  const isReply = !!parentCommentId;

  // Fetch org members for @mention autocomplete
  useEffect(() => {
    async function fetchOrgMembers() {
      if (!orgId) return;

      const { data, error } = await supabase
        .from("org_members")
        .select("user_id, full_name, avatar_url, users!inner(email)")
        .eq("org_id", orgId);

      if (error) {
        console.error("Failed to fetch org members:", error);
        return;
      }

      const members = data?.map((m: any) => ({
        user_id: m.user_id,
        full_name: m.full_name,
        avatar_url: m.avatar_url,
        email: m.users?.email,
      })) || [];

      setOrgMembers(members);
    }

    fetchOrgMembers();
  }, [orgId]);

  // Handle textarea changes and detect @ mentions
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.currentTarget.value;
    const newCursorPosition = e.currentTarget.selectionStart;

    setContent(newContent);
    setCursorPosition(newCursorPosition);

    // Detect @ mention
    const textBeforeCursor = newContent.substring(0, newCursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);

      // Check if we're in a mention context (no spaces after @)
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentionDropdown(true);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // Filter members based on mention search
  const filteredMembers = orgMembers.filter(
    (member) =>
      member.full_name.toLowerCase().includes(mentionSearch) ||
      member.email?.toLowerCase().includes(mentionSearch)
  );

  // Insert mention into textarea
  const insertMention = (member: OrgMember) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = content.substring(cursorPosition);

    // Replace @search with @[Name](uuid)
    const mentionText = `@[${member.full_name}](${member.user_id})`;
    const newContent =
      content.substring(0, lastAtSymbol) +
      mentionText +
      " " +
      textAfterCursor;

    setContent(newContent);
    setShowMentionDropdown(false);

    // Set cursor position after mention
    const newCursorPos = lastAtSymbol + mentionText.length + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Submit comment
  const handleSubmit = async () => {
    if (!content.trim()) {
      notifications.show({
        title: "Error",
        message: "Comment cannot be empty",
        color: "red",
      });
      return;
    }

    if (content.length > characterLimit) {
      notifications.show({
        title: "Error",
        message: `Comment must be ${characterLimit} characters or less`,
        color: "red",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const endpoint = grantId
        ? "/api/comments/grant-comments"
        : "/api/comments/task-comments";

      const body = {
        grant_id: grantId,
        task_id: taskId,
        content: content.trim(),
        parent_comment_id: parentCommentId || null,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create comment");
      }

      notifications.show({
        title: "Success",
        message: isReply ? "Reply posted" : "Comment posted",
        color: "green",
      });

      setContent("");
      onSuccess();
    } catch (error) {
      console.error("Failed to create comment:", error);
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to post comment",
        color: "red",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper p="md" withBorder radius="md">
      <Stack gap="sm">
        {isReply && parentCommentAuthor && (
          <Text size="sm" c="dimmed">
            Replying to {parentCommentAuthor}
          </Text>
        )}

        <Popover
          opened={showMentionDropdown && filteredMembers.length > 0}
          position="bottom-start"
          width="target"
          shadow="md"
        >
          <Popover.Target>
            <div>
              <Textarea
                ref={textareaRef}
                placeholder={
                  isReply
                    ? "Write your reply... (use @ to mention someone)"
                    : "Write a comment... (use @ to mention someone)"
                }
                value={content}
                onChange={handleContentChange}
                minRows={3}
                maxRows={10}
                autosize
                disabled={isSubmitting}
              />
            </div>
          </Popover.Target>
          <Popover.Dropdown p={0}>
            <ScrollArea h={200}>
              <Stack gap={0}>
                {filteredMembers.slice(0, 10).map((member) => (
                  <Group
                    key={member.user_id}
                    p="xs"
                    style={{
                      cursor: "pointer",
                      borderRadius: "4px",
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent textarea blur
                      insertMention(member);
                    }}
                    className="mention-option"
                  >
                    <Avatar
                      src={member.avatar_url}
                      alt={member.full_name}
                      size="sm"
                      radius="xl"
                    >
                      {member.full_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Text size="sm" fw={500}>
                        {member.full_name}
                      </Text>
                      {member.email && (
                        <Text size="xs" c="dimmed">
                          {member.email}
                        </Text>
                      )}
                    </div>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Popover.Dropdown>
        </Popover>

        <Group justify="space-between">
          <Text
            size="xs"
            c={characterCount > characterLimit ? "red" : "dimmed"}
          >
            {characterCount} / {characterLimit}
          </Text>

          <Group gap="xs">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={isSubmitting}
              leftSection={<IconSend size={16} />}
              disabled={!content.trim() || characterCount > characterLimit}
            >
              {isReply ? "Reply" : "Comment"}
            </Button>
          </Group>
        </Group>
      </Stack>

      <style>
        {`
          .mention-option:hover {
            background-color: var(--mantine-color-gray-0);
          }
        `}
      </style>
    </Paper>
  );
}
