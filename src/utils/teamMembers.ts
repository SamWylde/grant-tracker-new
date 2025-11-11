import type { Database } from "../lib/database.types";
import { supabase } from "../lib/supabase";

export interface TeamMemberOption {
  value: string;
  label: string;
  fullName: string | null;
}

export async function fetchTeamMemberOptions(orgId: string): Promise<TeamMemberOption[]> {
  const { data: members, error: membersError } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId);

  if (membersError) {
    throw membersError;
  }

  type OrgMemberRow = Database["public"]["Tables"]["org_members"]["Row"];
  const typedMembers = (members ?? []) as Pick<OrgMemberRow, "user_id">[];

  const userIds = Array.from(
    new Set(typedMembers.map((member) => member.user_id).filter((id): id is string => Boolean(id)))
  );

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, full_name")
    .in("id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];
  const typedProfiles = (profiles ?? []) as Pick<UserProfileRow, "id" | "full_name">[];

  const profileMap = new Map(typedProfiles.map((profile) => [profile.id, profile]));

  return userIds.map((userId) => {
    const profile = profileMap.get(userId);
    const displayName = profile?.full_name?.trim();
    const fallback = `Member ${userId.slice(0, 8)}`;

    return {
      value: userId,
      label: displayName || fallback,
      fullName: profile?.full_name ?? null,
    };
  });
}
