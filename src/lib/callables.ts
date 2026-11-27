import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Role } from '@/types';

export interface CreateUserInput {
  empNo: string;
  name: string;
  roles: Role[];
  pin: string;
}

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
export const resetPin = call<{ uid: string; pin: string }>('resetPin');

/** Turns Firebase callable errors into a message a user can act on. */
export function callableMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (!navigator.onLine) return 'You are offline. Connect to the internet and try again.';
  if (e?.code === 'functions/unavailable') return 'The server could not be reached. Try again in a moment.';
  return e?.message?.replace(/^.*?:\s*/, '') || 'Something went wrong. Try again.';
}
