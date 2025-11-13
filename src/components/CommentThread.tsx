import { Stack, Paper, Group, Text, Avatar, ActionIcon, Menu, Button, Textarea, Box } from "@mantine/core";
import { IconDots, IconEdit, IconTrash, IconCornerDownRight } from "@tabler/icons-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { notifications } from "@mantine/notifications";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Comment {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  content_html?: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  parent_comment_id: string | null;
  replies: Comment[];
}

interface CommentThreadProps {
  comments: Comment[];
  onReply: (parentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  level?: number;
  highlightCommentId?: string | null;
}

function CommentItem({
  comment,
  onReply,
  onEdit,
  onDelete,
  level = 0,
  highlightCommentId,
}: {
  comment: Comment;
  onReply: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  level: number;
  highlightCommentId?: string | null;
}) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  const isOwner = user?.id === comment.user_id;
  const indent = level * 32; // 32px per level

  // Scroll to and highlight this comment if it matches the highlightCommentId
  useEffect(() => {
    if (highlightCommentId && comment.id === highlightCommentId) {
      setIsHighlighted(true);
      // Scroll to comment after a brief delay to ensure DOM is ready
      setTimeout(() => {
        commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setIsHighlighted(false);
      }, 3000);
    }
  }, [highlightCommentId, comment.id]);

  const handleSaveEdit = async () => {
    if (editContent.trim() === comment.content.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
      notifications.show({
        title: "Success",
        message: "Comment updated",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update comment",
        color: "red",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(comment.id);
      notifications.show({
        title: "Success",
        message: "Comment deleted",
        color: "green",
      });
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete comment",
        color: "red",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Box ml={indent} ref={commentRef}>
      <Paper
        p="sm"
        withBorder
        radius="md"
        mb="sm"
        style={{
          backgroundColor: isHighlighted ? 'var(--mantine-color-blue-0)' : undefined,
          borderColor: isHighlighted ? 'var(--mantine-color-blue-6)' : undefined,
          transition: 'all 0.3s ease',
        }}
      >
        <Group justify="space-between" align="flex-start" mb="xs">
          <Group gap="sm">
            <Avatar
              src={comment.user_avatar}
              alt={comment.user_name}
              size="sm"
              radius="xl"
            >
              {comment.user_name.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Text size="sm" fw={600}>
                {comment.user_name}
              </Text>
              <Text size="xs" c="dimmed">
                {dayjs(comment.created_at).fromNow()}
                {comment.is_edited && <span> (edited)</span>}
              </Text>
            </div>
          </Group>

          {isOwner && !isDeleting && (
            <Menu shadow="md" width={150}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={handleDelete}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>

        {isEditing ? (
          <Stack gap="xs">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.currentTarget.value)}
              minRows={2}
              maxRows={8}
              autosize
            />
            <Group gap="xs">
              <Button size="xs" onClick={handleSaveEdit}>
                Save
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setEditContent(comment.content);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : (
          <>
            {comment.content_html ? (
              <div
                dangerouslySetInnerHTML={{ __html: comment.content_html }}
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  marginBottom: "8px",
                }}
                className="comment-content"
              />
            ) : (
              <Text
                size="sm"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                mb="xs"
              >
                {comment.content}
              </Text>
            )}

            <Button
              size="xs"
              variant="subtle"
              color="gray"
              leftSection={<IconCornerDownRight size={14} />}
              onClick={() => onReply(comment.id)}
            >
              Reply
            </Button>
          </>
        )}
      </Paper>

      {/* Render replies recursively */}
      {comment.replies && comment.replies.length > 0 && (
        <Stack gap={0}>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              level={level + 1}
              highlightCommentId={highlightCommentId}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function CommentThread({
  comments,
  onReply,
  onEdit,
  onDelete,
  level = 0,
  highlightCommentId,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <Paper p="md" withBorder radius="md">
        <Text size="sm" c="dimmed" ta="center">
          No comments yet. Be the first to comment!
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap={0}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          level={level}
          highlightCommentId={highlightCommentId}
        />
      ))}
    </Stack>
  );
}
