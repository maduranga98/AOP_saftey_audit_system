import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Role } from '@/types';

/** Safety officers: email + password. Everyone else: employee number + PIN. */
export type CreateUserInput =
  | { name: string; roles: Role[]; email: string; password: string }
  | { name: string; roles: Role[]; empNo: string; pin: string };

export interface UpdateUserInput {
  uid: string;
  name?: string;
  roles?: Role[];
  active?: boolean;
}

const call =
  <I, O = { ok: true }>(name: string) =>
  async (data: I): Promise<O> =>
    (await httpsCallable<I, O>(functions, name)(data)).data;

export const createUser = call<CreateUserInput, { ok: true; uid: string }>('createUser');
export const updateUser = call<UpdateUserInput>('updateUser');
/** New PIN for staff accounts, new password for safety officer accounts. */
export const resetCredential = call<{ uid: string; secret: string }>('resetCredential');
export const setupFirstAdmin = call<{ name: string; email: string; password: string; setupCode: string }>('setupFirstAdmin');

/** Turns Firebase callable errors into a message a user can act on. */
export function callableMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (!navigator.onLine) return 'You are offline. Connect to the internet and try again.';
  if (e?.code === 'functions/unavailable') return 'The server could not be reached. Try again in a moment.';
  return e?.message?.replace(/^.*?:\s*/, '') || 'Something went wrong. Try again.';
}
