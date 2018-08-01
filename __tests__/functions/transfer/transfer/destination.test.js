/* eslint-disable import/no-unresolved */

import Destination from '@functions/transfer/transfer/destination';
import Attribute from '@functions/transfer/transfer/attribute';
import File from '@functions/transfer/transfer/artifact/file';

import faker from 'faker';
import Path from 'path';
import { Credentials, STS } from 'aws-sdk';
import AWS from 'aws-sdk-mock';

describe('Destination', () => {
  const roleArn = faker.random.uuid();

  const bucket = faker.random.word();

  const artifact = {
    ready: async () => true,
    match: async () => {
      const path = Path.join('/', faker.random.uuid());
      const filename = faker.system.fileName();
      const data = Buffer.from(JSON.stringify({ [faker.random.uuid()]: faker.random.uuid() }));
      return [new File(path, filename, data)];
    },
  };

  const artifactName = faker.random.word();

  const artifacts = { [artifactName]: artifact };

  const sources = [`${artifactName}::**/*`];

  const prefix = Path.join('/', faker.random.uuid());

  const cwd = faker.random.uuid();

  const properties = { roleArn, bucket, src: sources, prefix, cwd };

  describe('#new', () => {
    it('instantiates correctly', () => {
      const destination = new Destination(properties, artifacts);
      expect(destination.artifacts).toEqual(artifacts);
      expect(destination.roleArn).toEqual(expect.any(Attribute));
      expect(destination.bucket).toEqual(expect.any(Attribute));
      expect(destination.sources).toEqual(sources);
      expect(destination.prefix).toEqual(prefix);
      expect(destination.cwd).toEqual(cwd);
      expect(destination.sts).toEqual(expect.any(STS));
    });

    describe('.roleArn resolution', () => {
      it('resolves to the correct value', () => {
        const destination = new Destination(properties, artifacts);
        expect(destination.roleArn.value()).resolves.toEqual(roleArn);
      });
    });

    describe('.bucket resolution', () => {
      it('resolves to the correct value', () => {
        const destination = new Destination(properties, artifacts);
        expect(destination.bucket.value()).resolves.toEqual(bucket);
      });
    });
  });

  describe('#credentials', () => {
    describe('when the request is successful', () => {
      const accessKeyId = faker.random.uuid();

      const secretAccessKey = faker.random.uuid();

      const sessionToken = faker.random.uuid();

      const credentials = {
        AccessKeyId: accessKeyId,
        SecretAccessKey: secretAccessKey,
        SessionToken: sessionToken,
      };

      beforeEach(() => {
        AWS.mock('STS', 'assumeRole', (params, cb) => {
          expect(params).toEqual(
            expect.objectContaining({
              RoleSessionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
              ExternalId: process.env.AWS_LAMBDA_FUNCTION_NAME,
              RoleArn: roleArn,
            })
          );
          cb(null, { Credentials: credentials });
        });
      });

      afterEach(() => {
        AWS.restore('STS', 'assumeRole');
      });

      it('returns a correctly instantiated AWS Credentials object', async () => {
        const destination = new Destination(properties, artifacts);
        const assumed = await destination.credentials();
        expect(assumed).toEqual(expect.any(Credentials));
        expect(assumed.accessKeyId).toEqual(accessKeyId);
        expect(assumed.secretAccessKey).toEqual(secretAccessKey);
        expect(assumed.sessionToken).toEqual(sessionToken);
      });
    });

    describe('when the request is invalid', () => {
      beforeEach(() => {
        AWS.mock('STS', 'assumeRole', (params, cb) => {
          cb(new Error('TEST'), {});
        });
      });

      afterEach(() => {
        AWS.restore('STS', 'assumeRole');
      });

      it('returns a correctly instantiated AWS Credentials object', () => {
        const destination = new Destination(properties, artifacts);
        return expect(destination.credentials()).rejects.toEqual(expect.any(Error));
      });
    });
  });

  describe('#files', () => {
    describe('when the artifact exists', () => {
      it('resolves with an array of instantiated files', () => {
        const destination = new Destination(properties, artifacts);
        return expect(destination.files()).resolves.toEqual(
          expect.arrayContaining([expect.any(File)])
        );
      });
    });

    describe('when there are no files', () => {
      const noFileProperties = { roleArn, bucket, src: [], prefix };

      it('resolves with an empty array', () => {
        const destination = new Destination(noFileProperties, artifacts);
        return expect(destination.files()).resolves.toEqual([]);
      });
    });

    describe('when the artifact does not exist', () => {
      const invalidFileProperties = {
        roleArn,
        bucket,
        src: [`${faker.random.uuid()}::${faker.system.fileName()}`],
        prefix,
      };

      it('resolves with an empty array', () => {
        const destination = new Destination(invalidFileProperties, artifacts);
        return expect(destination.files()).rejects.toEqual(expect.any(Error));
      });
    });
  });

  describe('#upload', () => {
    describe('when all files can be uploaded successfully', () => {
      const destination = new Destination(properties, artifacts);

      const uploadLocation = `s3://${faker.random.uuid()}/${faker.system.fileName()}`;

      const upload = jest.fn().mockImplementation(async () => uploadLocation);

      const credentials = new Credentials(
        faker.random.uuid(),
        faker.random.uuid(),
        faker.random.uuid()
      );

      jest.spyOn(destination, 'files').mockImplementation(async () => [{ upload }]);

      jest.spyOn(destination, 'credentials').mockImplementation(async () => credentials);

      it('resolves with an array of remote locations', async () => {
        const urls = await destination.upload();
        expect(urls).toEqual(expect.arrayContaining([expect.stringMatching(uploadLocation)]));
        expect(destination.files).toHaveBeenCalled();
        expect(destination.credentials).toHaveBeenCalled();
        expect(upload).toHaveBeenCalledWith(
          expect.objectContaining({
            bucket,
            credentials,
            prefix,
          })
        );
      });
    });
  });
});
