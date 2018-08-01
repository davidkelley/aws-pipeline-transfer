import File from '@functions/transfer/transfer/artifact/file';

import AWS from 'aws-sdk-mock';
import { Credentials } from 'aws-sdk';
import Path from 'path';
import fs from 'fs';
import faker from 'faker';

describe('File', () => {
  const path = Path.join('/', faker.random.uuid());

  const filename = faker.system.fileName();

  const absolutePath = Path.join('/tmp', faker.system.fileName());

  const data = faker.random.uuid();

  beforeEach(() => {
    fs.writeFileSync(absolutePath, data);
  });

  afterEach(() => {
    fs.unlinkSync(absolutePath);
  });

  describe('#new', () => {
    it('initialises correctly', () => {
      const file = new File(path, filename, absolutePath);
      expect(file.key).toEqual(Path.join('/', path, filename));
      expect(file.absolutePath).toEqual(absolutePath);
    });
  });

  describe('#contentType', () => {
    describe('when .html', () => {
      const htmlFilename = `${faker.random.uuid()}.html`;

      const expectedType = 'text/html';

      it('returns the correct contentType', () => {
        const file = new File(path, htmlFilename, absolutePath);
        expect(file.contentType).toEqual(expectedType);
      });
    });

    describe('when .txt', () => {
      const txtFilename = `${faker.random.uuid()}.txt`;

      const expectedType = 'text/plain';

      it('returns the correct contentType', () => {
        const file = new File(path, txtFilename, absolutePath);
        expect(file.contentType).toEqual(expectedType);
      });
    });

    describe('when (no extension)', () => {
      const nullFilename = faker.random.uuid();

      it('returns the expected contentType', () => {
        const file = new File(path, nullFilename, absolutePath);
        expect(file.contentType).toBe(null);
      });
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
        AWS.mock('S3', 'upload', (params, cb) => {
          expect(params).toEqual(
            expect.objectContaining({
              Bucket: bucket,
              Key: prefixed,
              ContentType: expect.any(String),
              Body: expect.any(fs.ReadStream),
            })
          );
          cb(null, {});
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'upload');
      });

      it('returns the correct fully resolved path', () => {
        const file = new File(path, filename, absolutePath);
        return expect(file.upload({ bucket, credentials, prefix })).resolves.toEqual(
          expect.stringMatching(`s3://${bucket}/${prefixed}`)
        );
      });
    });

    describe('when there is no prefix', () => {
      const filepath = Path.join('/', path, filename).replace(/^\//, '');

      beforeEach(() => {
        AWS.mock('S3', 'upload', (params, cb) => {
          expect(params).toEqual(
            expect.objectContaining({
              Bucket: bucket,
              Key: filepath,
              ContentType: expect.any(String),
              Body: expect.any(fs.ReadStream),
            })
          );
          cb(null, {});
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'upload');
      });

      it('returns the correct fully resolved path', () => {
        const file = new File(path, filename, absolutePath);
        return expect(file.upload({ bucket, credentials })).resolves.toEqual(
          expect.stringMatching(`s3://${bucket}/${filepath}`)
        );
      });
    });

    describe('when the upload fails', () => {
      beforeEach(() => {
        AWS.mock('S3', 'upload', (params, cb) => {
          cb(new Error('TEST'), {});
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'upload');
      });

      it('throws a well-formed error', () => {
        const file = new File(path, filename, absolutePath);
        return expect(file.upload({ bucket, credentials, prefix })).rejects.toEqual(
          expect.any(Error)
        );
      });
    });
  });
});
