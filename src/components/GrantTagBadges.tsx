import { Badge, Group } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

interface Tag {
  tag_id: string;
  tag_name: string;
  tag_slug: string;
  tag_category: string;
  color: string;
  ai_assigned: boolean;
  confidence_score: number | null;
}

interface GrantTagBadgesProps {
  grantId: string;
  maxTags?: number;
}

export function GrantTagBadges({ grantId, maxTags = 3 }: GrantTagBadgesProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["grantTags", grantId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch(
        `/api/grants/tags?external_id=${grantId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!grantId,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (isLoading || !data || !data.tags || data.tags.length === 0) {
    return null;
  }

  const tags: Tag[] = data.tags;
  const displayTags = tags.slice(0, maxTags);
  const remainingCount = tags.length - maxTags;

  return (
    <Group gap={4}>
      {displayTags.map((tag) => (
        <Badge
          key={tag.tag_id}
          size="xs"
          variant="light"
          style={{
            backgroundColor: tag.color ? `${tag.color}15` : undefined,
            color: tag.color || undefined,
            borderColor: tag.color || undefined,
          }}
        >
          {tag.tag_name}
        </Badge>
      ))}
      {remainingCount > 0 && (
        <Badge size="xs" variant="outline" color="gray">
          +{remainingCount}
        </Badge>
      )}
    </Group>
  );
}
