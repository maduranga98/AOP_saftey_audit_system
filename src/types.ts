export type Role = 'admin' | 'auditor' | 'area';
export type Portal = 'admin' | 'audit' | 'area';

export const PORTALS: Record<Portal, { role: Role; title: string; path: string }> = {
  audit: { role: 'auditor', title: 'Auditor', path: '/audit' },
  area: { role: 'area', title: 'Area owner / manager', path: '/area' },
  admin: { role: 'admin', title: 'Safety officer', path: '/admin' },
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Safety officer',
  auditor: 'Auditor',
  area: 'Area owner / manager',
};

/**
 * Directory entry kept in config/main so names resolve without extra reads.
 * Staff (auditors, area owners/managers) sign in with empNo + PIN; safety officers with email.
 */
export interface Person {
  uid: string;
  empNo: string;
  email?: string;
  name: string;
  roles: Role[];
  active: boolean;
}

export interface Area {
  id: string;
  name: string;
  order: number;
  /** Hidden areas (and their sub-areas) disappear from pickers; past audits keep them. */
  active?: boolean;
}

export interface ContractorLink {
  contractorId: string;
  scope: string;
}

export interface SubArea {
  id: string;
  areaId: string;
  name: string;
  order: number;
  ownerIds: string[];
  managerIds: string[];
  contractors: ContractorLink[];
  active: boolean;
}

export interface Contractor {
  id: string;
  name: string;
  active: boolean;
}

export interface Bands {
  /** Lowest % shown green. */
  green: number;
  /** Lowest % shown amber. Anything lower is red. */
  amber: number;
}

export interface ConfigMain {
  areas: Area[];
  subAreas: SubArea[];
  contractors: Contractor[];
  people: Person[];
  bands: Bands;
}

export interface Observation {
  id: string;
  text: string;
  order: number;
  active: boolean;
}

export interface ConfigChecklists {
  /** subAreaId -> observation list */
  lists: Record<string, Observation[]>;
}

export type ScoreValue = 0 | 0.25 | 0.5 | 0.75 | 1;

export const MAX_PHOTOS_PER_ITEM = 5;

/** One observation inside an audit, with a copy of the text it was scored against. */
export interface AuditItem {
  obsId: string;
  no: number;
  text: string;
  score: ScoreValue | null;
  na: boolean;
  remark: string;
  /** Storage paths of full-size photos. The thumbnail is the same path with a `_t` suffix. */
  photos: string[];
}

/** An audit in progress, kept only on the device. */
export interface AuditDraft {
  id: string;
  uid: string;
  subAreaId: string;
  startedAt: number;
  updatedAt: number;
  items: AuditItem[];
}

export interface AuditTotals {
  scoredSum: number;
  applicable: number;
  naCount: number;
  belowOneCount: number;
  photoCount: number;
  pct: number | null;
}

/** audits/{id}: written once by the auditor's device. */
export interface AuditDoc extends AuditTotals {
  id: string;
  month: string;
  date: string;
  areaId: string;
  areaName: string;
  subAreaId: string;
  subAreaName: string;
  auditorUid: string;
  auditorName: string;
  auditorEmpNo: string;
  ownerIds: string[];
  ownerNames: string[];
  managerIds: string[];
  managerNames: string[];
  assigneeIds: string[];
  contractors: { name: string; scope: string }[];
  items: AuditItem[];
  startedAt: number;
  clientSubmittedAt: number;
  submittedAt?: unknown;
  appVersion: string;
  voided?: boolean;
  voidReason?: string;
}

export type ActionStatus = 'open' | 'closed' | 'void';

/** actions/{auditId}_{obsId}: one per observation scored below 1. */
export interface ActionDoc {
  id: string;
  auditId: string;
  month: string;
  areaId: string;
  areaName: string;
  subAreaId: string;
  subAreaName: string;
  obsId: string;
  obsNo: number;
  obsText: string;
  score: ScoreValue;
  remark: string;
  photos: string[];
  raisedBy: string;
  raisedByName: string;
  raisedAt?: unknown;
  assigneeIds: string[];
  status: ActionStatus;
  response?: { comment: string; photos: string[]; byUid: string; byName: string; at: unknown };
  closedAt?: unknown;
}
