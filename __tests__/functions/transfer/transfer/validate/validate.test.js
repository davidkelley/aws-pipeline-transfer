/* eslint-disable import/no-unresolved */

import validate from '@functions/transfer/transfer/validate';

import faker from 'faker';

describe('#validate', () => {
  describe('when a schema is valid', () => {
    const data = [
      {
        bucket: faker.random.word(),
        prefix: '/some/random/key',
        roleArn: {
          'Fn::GetParam': ['DeployOutput', 'Outputs.json', 'S3BucketKey'],
        },
        src: [
          'BuildOutput::out/**/*.png',
        ],
      },
    ];

    it('resolves with the correct object', () =>
      expect(validate(data)).resolves.toMatchObject(data));
  });

  describe('when a schema is invalid', () => {
    it('rejects on empty schema', () =>
      expect(validate({})).rejects.toEqual(expect.any(Error)));
  });
});
