/* eslint-disable import/no-unresolved */

import File from '@functions/transfer/transfer/artifact/file';

import AWS from 'aws-sdk-mock';
import { Credentials } from 'aws-sdk';
import Path from 'path';
import faker from 'faker';

describe('File', () => {
  const path = Path.join('/', faker.random.uuid());

  const filename = faker.system.fileName();

  const data = new Buffer(JSON.stringify({ [faker.random.uuid()]: faker.random.uuid() }));

  describe('#new', () => {
    it('initialises correctly', () => {
      const file = new File(path, filename, data);
      const expectedPath = Path.join('/', path, filename);
      expect(file.key).toEqual(expectedPath);
      expect(file.data).toEqual(data);
    });
  });

  describe('#upload', () => {
    const accessKeyId = faker.random.uuid();

    const secretAccessKey = faker.random.uuid();

    const sessionToken = faker.random.uuid();

    const credentials = new Credentials(accessKeyId, secretAccessKey, sessionToken);

    const bucket = faker.random.uuid();

    const prefix = Path.join('/', faker.random.uuid());

    const prefixed = Path.join('/', prefix, path, filename).replace(/^\//, '');

    describe('when the upload succeeds', () => {
      beforeEach(() => {
        AWS.mock('S3', 'putObject', (params, cb) => {
          expect(params).toEqual(expect.objectContaining({
            Bucket: bucket,
            Key: prefixed,
            Body: data,
          }));
          cb(null, { });
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'putObject');
      });

      it('returns the correct fully resolved path', () => {
        const file = new File(path, filename, data);
        return expect(file.upload({ bucket, credentials, prefix })).resolves.toEqual(
          expect.stringMatching(`s3://${bucket}/${prefixed}`),
        );
      });
    });

    describe('when there is no prefix', () => {
      const filepath = Path.join('/', path, filename).replace(/^\//, '');

      beforeEach(() => {
        AWS.mock('S3', 'putObject', (params, cb) => {
          expect(params).toEqual(expect.objectContaining({
            Bucket: bucket,
            Key: filepath,
            Body: data,
          }));
          cb(null, { });
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'putObject');
      });

      it('returns the correct fully resolved path', () => {
        const file = new File(path, filename, data);
        return expect(file.upload({ bucket, credentials })).resolves.toEqual(
          expect.stringMatching(`s3://${bucket}/${filepath}`),
        );
      });
    });

    describe('when the upload fails', () => {
      beforeEach(() => {
        AWS.mock('S3', 'putObject', (params, cb) => {
          cb(new Error('TEST'), {});
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'putObject');
      });

      it('throws a well-formed error', () => {
        const file = new File(path, filename, data);
        return expect(file.upload({ bucket, credentials, prefix })).rejects.toEqual(
          expect.any(Error),
        );
      });
    });
  });
});
