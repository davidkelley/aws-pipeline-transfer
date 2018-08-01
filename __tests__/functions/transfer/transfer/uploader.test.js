/* eslint-disable import/no-unresolved */

import Uploader from '@functions/transfer/transfer/uploader';
import Artifact from '@functions/transfer/transfer/artifact';
import Destination from '@functions/transfer/transfer/destination';

import faker from 'faker';
import AWS from 'aws-sdk-mock';
import Zip from 'node-zip';

describe('Uploader', () => {
  const artifactName = faker.random.word();

  const roleArnKey = faker.random.word();

  const roleArn = faker.internet.url();

  const bucketKey = faker.random.word();

  const bucket = faker.random.uuid();

  const jsonFile = JSON.stringify({ [roleArnKey]: roleArn, [bucketKey]: bucket });

  const jsonFileName = faker.system.fileName();

  const credentials = {
    AccessKeyId: faker.random.uuid(),
    SecretAccessKey: faker.random.uuid(),
    SessionToken: faker.random.uuid(),
  };

  beforeEach(() => {
    const zipFile = new Zip();
    zipFile.file(jsonFileName, jsonFile);
    AWS.mock('S3', 'getObject', (params, cb) => {
      process.nextTick(() => {
        const zipped = zipFile.generate({ base64: false, compression: 'DEFLATE' });
        cb(null, { Body: Buffer.from(zipped, 'binary') });
      });
    });
  });

  beforeEach(() => {
    AWS.mock('S3', 'putObject', (params, cb) => {
      process.nextTick(() => {
        cb(null, {});
      });
    });
  });

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
    AWS.restore('S3', 'getObject');
    AWS.restore('STS', 'assumeRole');
  });

  const job = {
    data: {
      actionConfiguration: {
        configuration: {
          UserParameters: JSON.stringify([
            {
              roleArn: {
                'Fn::GetParam': [artifactName, jsonFileName, roleArnKey],
              },
              bucket: {
                'Fn::GetParam': [artifactName, jsonFileName, bucketKey],
              },
              src: [`${artifactName}::${jsonFileName}`],
            },
          ]),
        },
      },
      inputArtifacts: [
        {
          location: {
            s3Location: {
              bucketName: faker.random.word(),
              objectKey: faker.random.uuid(),
            },
          },
          name: artifactName,
        },
      ],
      artifactCredentials: {
        secretAccessKey: faker.random.uuid(),
        sessionToken: faker.random.uuid(),
        accessKeyId: faker.random.uuid(),
      },
    },
  };

  describe('#new', () => {
    describe('when the job is valid', () => {
      it('instantiates correctly', () => {
        const uploader = new Uploader(job);
        expect(uploader.data).toEqual(job.data);
        expect(uploader.parameters).toEqual(expect.any(Object));
        expect(uploader.artifacts).toEqual(
          expect.objectContaining({
            [artifactName]: expect.any(Artifact),
          })
        );
      });
    });

    describe('when there are no input artifacts', () => {
      const invalidJob = {
        data: {
          actionConfiguration: {
            configuration: {
              UserParameters: JSON.stringify({}),
            },
          },
          inputArtifacts: [],
        },
      };

      it('throws an error', () => expect(() => new Uploader(invalidJob)).toThrow(Error));
    });
  });

  describe('#userParameters', () => {
    describe('when data is valid', () => {
      it('returns the correct data object', () => {
        const uploader = new Uploader(job);
        return expect(uploader.userParameters()).resolves.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              roleArn: {
                'Fn::GetParam': [artifactName, jsonFileName, roleArnKey],
              },
              bucket: {
                'Fn::GetParam': [artifactName, jsonFileName, bucketKey],
              },
              src: [`${artifactName}::${jsonFileName}`],
            }),
          ])
        );
      });
    });

    describe('when there is no data', () => {
      it('throws an error', () => {
        const uploader = new Uploader(job);
        uploader.parameters = {};
        return expect(uploader.userParameters()).rejects.toEqual(expect.any(Error));
      });
    });

    describe('when data is not valid', () => {
      const invalidData = [
        {
          [faker.random.uuid()]: faker.random.number(),
        },
      ];

      it('throws an error', () => {
        const uploader = new Uploader(job);
        uploader.parameters = invalidData;
        return expect(uploader.userParameters()).rejects.toEqual(expect.any(Error));
      });
    });
  });

  describe('#destinations', () => {
    describe('when the job is valid', () => {
      it('returns an array of destination objects', () => {
        const uploader = new Uploader(job);
        return expect(uploader.destinations()).resolves.toEqual(
          expect.arrayContaining([expect.any(Destination)])
        );
      });
    });

    describe('when the job is invalid', () => {
      const invalidData = [
        {
          [faker.random.uuid()]: faker.random.number(),
        },
      ];

      it('throws an error', () => {
        const uploader = new Uploader(job);
        uploader.parameters = invalidData;
        return expect(uploader.destinations()).rejects.toEqual(expect.any(Error));
      });
    });
  });

  describe('#perform', () => {
    describe('when the destination can be uploaded', () => {
      const remoteLocation = faker.internet.url();

      const upload = jest.fn().mockImplementation(async () => remoteLocation);

      const uploader = new Uploader(job);

      jest.spyOn(uploader, 'destinations').mockImplementation(async () => [{ upload }]);

      it('returns an array of remote locations', async () => {
        const urls = await uploader.perform();
        expect(urls).toEqual(expect.arrayContaining([expect.stringMatching(remoteLocation)]));
        expect(upload).toHaveBeenCalled();
        expect(uploader.destinations).toHaveBeenCalled();
      });
    });
  });
});
