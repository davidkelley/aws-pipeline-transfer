import fs from 'fs';
import glob from 'glob';
import uuid from 'uuid/v4';
import Path from 'path';
import extract from 'extract-zip';
import { S3 } from 'aws-sdk';
import wrappedError from 'error/wrapped';
import typedError from 'error/typed';

import { AWS_REGION } from '../../../globals';

import File from './file';

/**
 * An error was encountered when attempting to download, commit and uncompress
 * the remote CodePipeline artifact.
 *
 * @type {Error}
 */
const readyError = wrappedError({
  message: 'Error occurred retrieving artifact',
  type: 'pipeline.artifact',
});

/**
 * The remote artifact could not be retrieved (S3 Error).
 *
 * @type {Error}
 */
const fetchError = wrappedError({
  message: 'Could not retrieve artifact.',
  type: 'pipeline.artifact.file',
});

/**
 * An error was encountered whilst attempting to read a file from inside the
 * artifact.
 *
 * @type {Error}
 */
const readError = wrappedError({
  message: 'Could not read artifact file "{filename}"',
  type: 'pipeline.artifact.file',
});

/**
 * The artifact was successfully downloaded, but an error occurred whilst
 * attempting to decompress it.
 *
 * @type {Error}
 */
const decompressionError = wrappedError({
  message: 'Failed to decompress artifact.',
  type: 'pipeline.artifact.file.decompression',
});

/**
 * The JSON key does not exist in the file.
 *
 * @type {Error}
 */
const keyNotFoundError = typedError({
  message: 'Key "{key}" not found in file "{filename}"',
  type: 'pipeline.artifact.file.json',
});

/**
 * This class handles retrieving CodePipeline artifact files as well as accessing
 * file contents in addition to attributes defined inside JSON files residing
 * within the artifact.
 *
 * As the artifacts passed to the function may reside within remote buckets which
 * this function does not have sufficient permissions to access, credentials are
 * used from the initial CodePipeline event object.
 */
export default class Artifact {
  /**
   * Constructs a new Artifact instance.
   *
   * @param {Object} s3Location - object representing a remote S3 location
   * @param {String} s3Location.bucketName - the name of the S3 bucket.
   * @param {String} s3Location.objectKey - the key of the file inside the S3 bucket.
   */
  constructor({ bucketName, objectKey }, { secretAccessKey, sessionToken, accessKeyId }) {
    /**
     * A local ID for this artifact.
     *
     * @type {String}
     */
    this.id = uuid();
    /**
     * A filename representing the name of the artifact once downloaded and stored
     * locally.
     *
     * @type {String}
     */
    this.filename = `${this.id}.zip`;
    /**
     * A fully resolved Path to the local artifact when downloaded and written
     * to the `/tmp/` directory.
     *
     * @type {String}
     */
    this.filepath = Path.join('/tmp/', this.filename);
    /**
     * A fully resolved path to the directory storing the decompressed contents
     * of the remote artifact in the `/tmp` directory.
     *
     * @type {String}
     */
    this.dir = Path.join('/tmp/', this.id);
    /**
     * The name of the S3 bucket which the remote artifact file resides in.
     *
     * @type {String}
     */
    this.bucketName = bucketName;
    /**
     * The key for the remote artifact file.
     *
     * @type {String}
     */
    this.objectKey = objectKey;
    /**
     * The AWS Secret Access Key which will be used to retrieve the remote artifact.
     *
     * @type {String}
     */
    this.secretAccessKey = secretAccessKey;
    /**
     * The AWS Session Token which will be used to retrieve the remote artifact.
     *
     * @type {String}
     */
    this.sessionToken = sessionToken;
    /**
     * The AWS Access Key ID which will be used to retrieve the remote artifact.
     *
     * @type {String}
     */
    this.accessKeyId = accessKeyId;
    /**
     * Determines if this artifact has been retrieved, decompressed and
     * written to local file storage.
     *
     * @type {Boolean}
     */
    this.isReady = false;
  }

  /**
   * Transform the properties received from CodePipeline into a new instance
   * of this class.
   *
   * This function maps the required properties from the CodePipeline invocation
   * event structure.
   *
   * @return {Artifact} a new artifact file with correctly mapped parameters.
   */
  static toArtifact(artifact, credentials = {}) {
    const {
      location: { s3Location },
    } = artifact;
    return new Artifact(s3Location, credentials);
  }

  /**
   * Returns an array which can be used to constuct a Map of artifacts.
   *
   * @return {Array[String, Artifact]}
   */
  static toArtifactMapEntry(artifact, credentials) {
    return [artifact.name, Artifact.toArtifact(artifact, credentials)];
  }

  /**
   * A utility function to ensure that this artifact has first retrived and
   * decompressed the remote artifact file, before any attempts are made
   * to retrieve artifact contents.
   *
   * @return {Boolean} true if ready, false otherwise.
   */
  async ready() {
    try {
      if (!this.isReady) {
        const data = await this.fetch();
        await this.write(data);
        await this.unzip();
        this.isReady = true;
      }
      return this.isReady;
    } catch (err) {
      throw readyError(err);
    }
  }

  /**
   * Returns an array of {@link File} instances which represent all matched
   * files from inside the retrieved, decompressed artifact.
   *
   * @param {String} select - a linux-style file glob to match files with.
   * @param {String} path - a relative path used to match files
   *
   * @return {Array[File]} an array of all matched {@link File} instances.
   */
  async match(select, path = '') {
    return new Promise((resolve, reject) => {
      try {
        const { dir } = this;
        const cwd = Path.join(dir, path);
        glob(select, { cwd, nonull: false, nodir: true }, (err, files) => {
          if (err) {
            // TODO: throw error
          } else {
            resolve(
              files.map(file => {
                const { dir: relativeDir, base: filename } = Path.parse(file);
                return new File(relativeDir, filename, Path.join(cwd, file));
              })
            );
          }
        });
      } catch (err) {
        // TODO: catch error
        reject();
      }
    });
  }

  /**
   * Once {@link Artifact#ready} has resolved successfully, this function
   * can be used to retrieve a specific file's contents from within the
   * decompressed artifact.
   *
   * @return {Buffer} a utf-8 buffer of the file's contents.
   */
  get(filename) {
    try {
      const { dir } = this;
      const path = Path.join(dir, filename);
      return fs.readFileSync(path, { encoding: 'utf8' });
    } catch (err) {
      throw readError(err, { filename });
    }
  }

  /**
   * Once {@link Artifact#ready} has resolved successfully, this function
   * can be used to retrieve the value of a specific property key from within
   * a JSON file residing inside the decompressed artifact.
   *
   * @return [String] the value of the key from within a JSON file.
   */
  attribute(filename, key) {
    try {
      const obj = JSON.parse(this.get(filename));
      if (!Object.keys(obj).includes(key)) {
        throw keyNotFoundError({ filename, key });
      } else {
        return obj[key];
      }
    } catch (err) {
      throw readError(err, { filename });
    }
  }

  /**
   * @private
   *
   * Assuming that the remote artifact has been downloaded and written to
   * {@link Artifact#filepath}, attempt to extract the contents of the artifact
   * into {@link Artifact#dir}.
   *
   * @return {Boolean} true once contents have been successfully decompressed.
   */
  unzip() {
    return new Promise((resolve, reject) => {
      const { filepath, dir } = this;
      fs.mkdirSync(dir);
      extract(filepath, { dir }, err => {
        if (err) {
          reject(decompressionError(err));
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * @private
   *
   * Write the contents of the compressed, remote artifact to {@link Artifact#filepath}.
   *
   * @return {Boolean} true once the file has been written.
   */
  async write(data) {
    const { filepath } = this;
    fs.writeFileSync(filepath, data, { encoding: 'utf8' });
    return true;
  }

  /**
   * @private
   *
   * Using the S3 client ({@link Artifact#client}) retrieve the artifact from
   * the remote S3 bucket.
   *
   * @return {Buffer} the buffer contents of the remote artifacts retrieved from S3.
   */
  async fetch() {
    try {
      const { bucketName, objectKey } = this;
      const params = { Bucket: bucketName, Key: objectKey };
      const { Body } = await this.client.getObject(params).promise();
      return Body;
    } catch (err) {
      throw fetchError(err);
    }
  }

  /**
   * Returns a new S3 client with credentials pre-configured.
   *
   * @type {S3}
   */
  get client() {
    const { secretAccessKey, sessionToken, accessKeyId } = this;
    return new S3({ region: AWS_REGION, accessKeyId, secretAccessKey, sessionToken });
  }
}
