import Path from 'path';
import mime from 'mime-types';
import { S3 } from 'aws-sdk';
import wrappedError from 'error/wrapped';

import { AWS_REGION } from '../../../globals';

/**
 * The JSON key does not exist in the file.
 *
 * @type {Error}
 */
const uploadError = wrappedError({
  message: 'Failed to upload file with key "{key}"',
  type: 'pipeline.artifact.file.upload',
});

/**
 * Represents a file inside an artifact.
 *
 */
export default class File {
  /**
   * @param {String} path - the path to the file inside the artifact
   * @param {String} filename - The name of the file, including the extension name
   * @param {Buffer} data - A buffer of the files contents.
   */
  constructor(path, filename, data) {
    /**
     * The S3 key which represents this file (path + filename)
     *
     * @type {String}
     */
    this.key = Path.join('/', path, filename);
    /**
     * The data contained inside the file
     *
     * @type {Buffer}
     */
    this.data = data;
  }

  /**
   * The determined mime type for the file
   *
   * @type {String}
   */
  get contentType() {
    const { key } = this;
    return mime.lookup(key) || null;
  }

  /**
   * Uploads the file to the specific remote S3 bucket, using the supplied
   * credentials and an optional prefix.
   *
   * @param {Object} opts - An options object
   * @param {String} opts.bucket - The bucket to upload the file to.
   * @param {Credentials} opts.credentials - An instantiated AWS.Credentials object.
   * @param {String} opts.prefix - An optional prefix to apply to this file.
   */
  async upload({ bucket: Bucket, credentials, prefix = '' }) {
    const { data, key, contentType: ContentType } = this;
    try {
      const s3 = new S3({ region: AWS_REGION, credentials });
      const prefixedKey = Path.join('/', prefix, key).replace(/^\//, '');
      const params = { Bucket, Key: prefixedKey, Body: data, ContentType };
      await s3.putObject(params).promise();
      return `s3://${Bucket}/${prefixedKey}`;
    } catch (err) {
      throw uploadError(err, { key });
    }
  }
}
