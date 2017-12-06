/* eslint-disable import/no-unresolved */

import Artifact from '@functions/transfer/transfer/artifact';

import S3 from 'aws-sdk/clients/s3';
import AWS from 'aws-sdk-mock';
import faker from 'faker';
import Zip from 'node-zip';
import fs from 'fs';

describe('Artifact', () => {
  const bucketName = faker.random.uuid();

  const objectKey = faker.random.uuid();

  const secretAccessKey = faker.random.uuid();

  const sessionToken = faker.random.uuid();

  const accessKeyId = faker.random.uuid();

  const credentials = { secretAccessKey, sessionToken, accessKeyId };

  const location = { bucketName, objectKey };

  describe('#id', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.id).toEqual(expect.stringMatching(/^[-a-zA-Z0-9]+$/));
    });
  });

  describe('#filename', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.filename).toEqual(`${artifact.id}.zip`);
    });
  });

  describe('#filepath', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.filepath).toEqual(`/tmp/${artifact.id}.zip`);
    });
  });

  describe('#dir', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.dir).toEqual(expect.stringMatching(/^\/tmp\/[-a-zA-Z0-9]+$/));
    });
  });

  describe('#bucketName', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.bucketName).toEqual(bucketName);
    });
  });

  describe('#objectKey', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.objectKey).toEqual(objectKey);
    });
  });

  describe('#secretAccessKey', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.secretAccessKey).toEqual(secretAccessKey);
    });
  });

  describe('#sessionToken', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.sessionToken).toEqual(sessionToken);
    });
  });

  describe('#accessKeyId', () => {
    it('returns the correct value', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.accessKeyId).toEqual(accessKeyId);
    });
  });

  describe('#ready', () => {
    const artifact = new Artifact(location, credentials);

    const { dir, filepath } = artifact;

    const key = faker.random.word();

    const value = faker.random.number();

    const jsonFile = `${faker.random.uuid()}.json`;

    const data = JSON.stringify({ [key]: value });

    describe('when the artifact readys successfully', () => {
      beforeEach(() => {
        const zipFile = new Zip();
        zipFile.file(jsonFile, data);
        const zipped = zipFile.generate({ base64: false, compression: 'DEFLATE' });
        AWS.mock('S3', 'getObject', (params, cb) => {
          expect(params).toEqual(expect.objectContaining({
            Bucket: bucketName,
            Key: objectKey,
          }));
          cb(null, { Body: new Buffer(zipped, 'binary') });
        });
      });

      afterEach(() => {
        fs.unlinkSync(filepath);
        fs.unlinkSync(`${dir}/${jsonFile}`);
        fs.rmdirSync(dir);
        AWS.restore('S3', 'getObject');
      });

      it('fetches, loads and unzips correctly', () =>
        expect(artifact.ready()).resolves.toBe(true));
    });

    describe('when the artifact fails to ready', () => {
      const invalidArtifact = new Artifact({}, credentials);

      it('rejects with an error', () =>
        expect(invalidArtifact.ready()).rejects.toEqual(expect.any(Error)));
    });
  });

  describe('#match', () => {
    describe('when files are matched', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const relativePath = 'output';

      const path = `${dir}/${relativePath}`;

      const filename = faker.system.fileName();

      const selector = '**/*';

      const data = JSON.stringify({ [faker.random.word()]: faker.random.number() });

      beforeEach(() => {
        fs.mkdirSync(dir);
        fs.mkdirSync(path);
        fs.writeFileSync(`${path}/${filename}`, data, { encoding: 'utf8' });
      });

      afterEach(() => {
        fs.unlinkSync(`${path}/${filename}`);
        fs.rmdirSync(path);
        fs.rmdirSync(dir);
      });

      it('should return the correct files', async () => {
        const [file] = await artifact.match(selector);
        expect(file.key).toEqual(`/${filename}`);
        expect(file.data).toEqual(new Buffer(data).toString('binary'));
      });
    });
  });

  describe('#get', () => {
    describe('when the file exists', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const filename = faker.random.uuid();

      const data = JSON.stringify({ [faker.random.word()]: faker.random.number() });

      beforeEach(() => {
        fs.mkdirSync(dir);
        fs.writeFileSync(`${dir}/${filename}`, data, { encoding: 'utf8' });
      });

      afterEach(() => {
        fs.unlinkSync(`${dir}/${filename}`);
        fs.rmdirSync(dir);
      });

      it('should return the file', () => {
        expect(artifact.get(filename)).toEqual(data);
      });
    });

    describe('when the file does not exist', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const filename = faker.random.uuid();

      beforeEach(() => {
        fs.mkdirSync(dir);
      });

      afterEach(() => {
        fs.rmdirSync(dir);
      });

      it('throws an error', () => {
        expect(() => artifact.get(filename)).toThrow(Error);
      });
    });
  });

  describe('#attribute', () => {
    describe('when the file and key exists', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const filename = faker.random.uuid();

      const key = faker.random.word();

      const value = faker.random.number();

      const data = JSON.stringify({ [key]: value });

      beforeEach(() => {
        fs.mkdirSync(dir);
        fs.writeFileSync(`${dir}/${filename}`, data, { encoding: 'utf8' });
      });

      afterEach(() => {
        fs.unlinkSync(`${dir}/${filename}`);
        fs.rmdirSync(dir);
      });

      it('should return the file', () => {
        expect(artifact.attribute(filename, key)).toEqual(value);
      });
    });

    describe('when the files does not exist', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const filename = faker.random.uuid();

      const key = faker.random.word();

      beforeEach(() => {
        fs.mkdirSync(dir);
      });

      afterEach(() => {
        fs.rmdirSync(dir);
      });

      it('should throw an error', () => {
        expect(() => artifact.attribute(filename, key)).toThrow(Error);
      });
    });

    describe('when the key is not present', () => {
      const artifact = new Artifact(location, credentials);

      const { dir } = artifact;

      const filename = faker.random.uuid();

      const key = faker.random.word();

      const data = JSON.stringify({});

      beforeEach(() => {
        fs.mkdirSync(dir);
        fs.writeFileSync(`${dir}/${filename}`, data, { encoding: 'utf8' });
      });

      afterEach(() => {
        fs.unlinkSync(`${dir}/${filename}`);
        fs.rmdirSync(dir);
      });

      it('should throw an error', () => {
        expect(() => artifact.attribute(filename, key)).toThrow(Error);
      });
    });
  });

  describe('#unzip', () => {
    describe('when the artifact can be unzipped', () => {
      const artifact = new Artifact(location, credentials);

      const { filepath } = artifact;

      const key = `${faker.random.uuid()}.json`;

      const data = JSON.stringify({ [faker.random.word()]: faker.random.number() });

      beforeEach(() => {
        const zipFile = new Zip();
        zipFile.file(key, data);
        const zipped = zipFile.generate({ base64: false, compression: 'DEFLATE' });
        fs.writeFileSync(filepath, zipped, 'binary');
      });

      afterEach(() => {
        fs.unlinkSync(filepath);
      });

      it('should unzip the file', async () => {
        const success = await artifact.unzip();
        expect(success).toBe(true);
        expect(artifact.get(key)).toEqual(data);
      });
    });

    describe('when the artifact cannot be unzipped', () => {
      const artifact = new Artifact(location, credentials);

      const { filepath } = artifact;

      beforeEach(() => {
        fs.writeFileSync(filepath, '', 'utf8');
      });

      afterEach(() => {
        fs.unlinkSync(filepath);
      });

      it('reject with an error', async () =>
        expect(artifact.unzip()).rejects.toEqual(expect.any(Error)));
    });
  });

  describe('#write', () => {
    const artifact = new Artifact(location, credentials);

    const data = JSON.stringify({ [faker.random.word()]: faker.random.number() });

    it('writes a file to the correct location', () =>
      expect(artifact.write(data)).resolves.toEqual(true));

    afterEach(() => {
      fs.unlinkSync(artifact.filepath);
    });
  });

  describe('#fetch', () => {
    describe('when the artifact can be retrieved', () => {
      const artifact = new Artifact(location, credentials);

      const data = JSON.stringify({ [faker.random.word()]: faker.random.number() });

      beforeEach(() => {
        AWS.mock('S3', 'getObject', (params, cb) => {
          expect(params).toEqual(expect.objectContaining({
            Bucket: bucketName,
            Key: objectKey,
          }));
          cb(null, { Body: new Buffer(data) });
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'getObject');
      });

      it('should retrieve the correct data', () =>
        expect(artifact.fetch()).resolves.toEqual(new Buffer(data)));
    });

    describe('when the artifact cannot be retrieved', () => {
      const artifact = new Artifact(location, credentials);

      beforeEach(() => {
        AWS.mock('S3', 'getObject', (params, cb) => {
          cb(new Error('TEST'));
        });
      });

      afterEach(() => {
        AWS.restore('S3', 'getObject');
      });

      it('should reject with an error', () =>
        expect(artifact.fetch()).rejects.toEqual(expect.any(Error)));
    });
  });

  describe('#client', () => {
    it('returns an S3 client', () => {
      const artifact = new Artifact(location, credentials);
      expect(artifact.client).toBeInstanceOf(S3);
    });
  });
});

describe('Artifact#toArtifact', () => {
  const bucketName = faker.random.uuid();

  const objectKey = faker.random.uuid();

  const secretAccessKey = faker.random.uuid();

  const sessionToken = faker.random.uuid();

  const accessKeyId = faker.random.uuid();

  const credentials = { secretAccessKey, sessionToken, accessKeyId };

  const name = faker.random.word();

  const artifact = { name, location: { s3Location: { bucketName, objectKey } } };

  it('correctly builds an artifact instance', () => {
    const obj = Artifact.toArtifact(artifact, credentials);
    expect(obj).toBeInstanceOf(Artifact);
    expect(obj.bucketName).toEqual(bucketName);
    expect(obj.objectKey).toEqual(objectKey);
    expect(obj.secretAccessKey).toEqual(secretAccessKey);
    expect(obj.sessionToken).toEqual(sessionToken);
    expect(obj.accessKeyId).toEqual(accessKeyId);
  });
});

describe('Artifact#toArtifactMapEntry', () => {
  const bucketName = faker.random.uuid();

  const objectKey = faker.random.uuid();

  const secretAccessKey = faker.random.uuid();

  const sessionToken = faker.random.uuid();

  const accessKeyId = faker.random.uuid();

  const credentials = { secretAccessKey, sessionToken, accessKeyId };

  const name = faker.random.word();

  const artifact = { name, location: { s3Location: { bucketName, objectKey } } };

  it('correctly builds an artifact instance', () => {
    const arr = Artifact.toArtifactMapEntry(artifact, credentials);
    expect(arr[0]).toEqual(name);
    expect(arr[1]).toBeInstanceOf(Artifact);
  });
});
