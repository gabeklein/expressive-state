export { mockError, mockPromise, mockWarn } from '../../vitest.setup';

import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(cleanup);

export * from 'vitest';
export * from '@testing-library/preact';
