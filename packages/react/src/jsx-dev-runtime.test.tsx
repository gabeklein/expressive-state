import { expect, it } from '../vitest';

import { State } from '.';
import { Fragment, jsxDEV } from './jsx-dev-runtime';

it('exports jsxDEV', () => {
  expect(jsxDEV).toBeDefined();
});

it('exports Fragment', () => {
  expect(Fragment).toBeDefined();
});

it('will convert State to element', () => {
  class Test extends State {}

  const element = jsxDEV(Test, { children: 'Hello' }, 'key', false);

  expect(element).toMatchObject({
    type: expect.any(Function),
    props: {
      children: 'Hello'
    }
  });
});
