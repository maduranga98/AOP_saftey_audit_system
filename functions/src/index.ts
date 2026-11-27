import { setGlobalOptions } from 'firebase-functions/v2';

// Mumbai is the nearest region to the plant. maxInstances keeps any runaway loop from costing money.
setGlobalOptions({ region: 'asia-south1', maxInstances: 5, memory: '256MiB' });

export { setupFirstAdmin, createUser, updateUser, resetCredential } from './users';
export { onConfigMainUpdated } from './assignments';
export { onAuditVoided } from './voids';
