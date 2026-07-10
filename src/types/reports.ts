export type ReportActionState = {
  success: boolean;
  error?: string;
};

export const reportActionInitialState: ReportActionState = {
  success: false,
};
