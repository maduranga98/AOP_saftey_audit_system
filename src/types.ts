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

/** Directory entry kept in config/main so names resolve without extra reads. */
export interface Person {
  uid: string;
  empNo: string;
  name: string;
  roles: Role[];
  active: boolean;
}

export interface Area {
  id: string;
  name: string;
  order: number;
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
