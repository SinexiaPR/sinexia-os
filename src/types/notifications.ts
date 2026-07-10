export type NavBadgeCounts = {
  inbox: number;
  notifications: number;
};

export type ClientReportNotifications = {
  profileId: string;
  reportCreatedAts: string[];
  reports: { id: string; created_at: string }[];
  unreadReportsCount: number;
};
