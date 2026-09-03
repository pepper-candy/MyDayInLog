export type DaylogProfile = {
  id: string;
  invitation_code: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ActivityType = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort: number;
  archived: boolean;
};

export type TimeBlock = {
  id: string;
  user_id: string;
  activity_type_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  activity?: Pick<ActivityType, "id" | "name" | "color"> | null;
};

export type ActiveBlockState = {
  blockId: string;
  activityTypeId: string;
  activityName: string;
  activityColor: string;
  startedAt: string;
  serverNow: string;
};

export type DaySummaryRow = {
  activityTypeId: string;
  name: string;
  color: string;
  seconds: number;
};
