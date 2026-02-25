import { createElement, Suspense } from 'react';
export { mockError, mockPromise, mockWarn } from '../../vitest.setup';

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Provider, State } from './src';

afterEach(cleanup);

export * from 'vitest';
export * from '@testing-library/react';

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper(props) {
      return createElement(
        Provider,
        { for: Type },
        createElement(Suspense, { fallback: null }, props.children)
      );
    }
  });
}

export { renderWith };
