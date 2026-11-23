export type R2StudioMemberPublic = {
  name: string;
  usedBytes?: number;
  capacityBytes?: number;
};

export type R2StudioPool = {
  totalUsed?: number;
  totalCapacity?: number;
  target?: string | number;
  members?: R2StudioMemberPublic[];
};

export type R2StudioPublicStatus = {
  baseUrl: string;
  keyConfigured: boolean;
  keyFromEnv: boolean;
  enabled: boolean;
  storageMode: string;
  testedAt: string | null;
  lastError: string;
  activeTarget?: "r2studio" | "r2" | "none";
  studioReady?: boolean;
  r2Ready?: boolean;
  r2NodeCount?: number;
  ready?: boolean;
  pool?: R2StudioPool | null;
  message?: string;
};
