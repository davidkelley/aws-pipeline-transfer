/* eslint-disable import/no-unresolved */

import Schema from '@functions/transfer/transfer/validate/schema';

import Ajv from 'ajv';

describe('Schema', () => {
  it('compiles successfully', () => {
    expect(() => {
      new Ajv().compile(Schema);
    }).not.toThrow();
  });
});
