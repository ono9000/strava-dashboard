export interface WearableSnapshot {
  recoveryScore?: number;
  sleepHours?: number;
  sleepEfficiency?: number;
  sleepQuality?: number;
  strainYesterday?: number;
  hrv?: number;
  restingHeartRate?: number;
}

export interface CalendarSnapshot {
  meetingsCount: number;
  focusBlocksPlanned: number;
  decisionLoad: number;
  travelLoad: number;
  socialHeavyMeetings: number;
}

export interface IngestionResult {
  signalDate: string;
  source: string[];
  warnings?: string[];
}
