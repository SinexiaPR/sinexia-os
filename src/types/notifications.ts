export type NavBadgeCounts = {
  inbox: number;
};

export type ClientReportNotifications = {
  profileId: string;
  reportIds: string[];
  viewedReportIds: string[];
  documentIds: string[];
  viewedDocumentIds: string[];
};

export type WorkspaceNotifications = {
  unreadCount: number;
};
