import { STS, Credentials } from 'aws-sdk';
import typedError from 'error/typed';

import Attribute from './attribute';
import { FUNCTION_NAME } from './constants';

/**
 * The AWS STS client used to assume roles inside the lambda function
 * for the appropriate S3 destination.
 *
 * @type {STS}
 */
const sts = new STS();

/**
 * The defined remote artifact does not exist or access has not been granted.
 *
 * @type {Error}
 */
const artifactNotFound = typedError({
  message: 'Artifact "{artifactName}" not a valid InputArtifact',
  type: 'pipeline.artifact.not_found',
});

/**
 * This class represents a single, defined destination which the user
 * has specified inside the UserParameters key.
 *
 * Responsible for first resolving any source input artifacts and matching
 * all files found inside the artifact. Then assuming the correct role to
 * access the destination, and uploading them, using the {@link File#upload}
 * method.
 */
export default class Destination {
  /**
   * @param {Object} destination - a valid src/destination object.
   * @param {String, Object} destination.roleArn - a static or remote reference
   *  to a IAM Role which has sufficient permissons for the destination S3 Bucket.
   * @param {String, Object} destination.bucket - a static or remote reference
   *  to a destination S3 bucket.
   * @param {Array[String]} destination.src - An array of source files to be
   *  found inside one or more input artifacts.
   * @param {String} destination.prefix - The prefix to apply to all uploaded
   *  source files in the destination S3 bucket.
   * @param {Object} artifacts - An object containing all
   *  {@link Artifact} instances with the property key being the artifacts name.
   */
  constructor({ roleArn, bucket, src, prefix = '/' }, artifacts) {
    /**
     * A static or remote reference to a IAM Role which has sufficient
     * permissons for the destination S3 Bucket.
     *
     * @type {Attribute}
     */
    this.roleArn = new Attribute(roleArn, artifacts);
    /**
     * A static or remote reference to a destination S3 bucket.
     *
     * @type {Attribute}
     */
    this.bucket = new Attribute(bucket, artifacts);
    /**
     * An array of source files to be found inside one or more input artifacts.
     *
     * @type {Array[String]}
     */
    this.sources = src;
    /**
     * The prefix to apply to all uploaded source files in the
     * destination S3 bucket.
     *
     * @type {String}
     */
    this.prefix = prefix;
  }

  /**
   * Retrieves credentials by assuming the defined role, which (should) enable
   * IAM access to the remote S3 destination.
   *
   * @return {Object} an object containing AWS access keys.
   */
  async credentials() {
    const roleArn = await this.roleArn.value();
    const {
      Credentials: {
        AccessKeyId,
        SecretAccessKey,
        SessionToken,
      },
    } = await sts.assumeRole({
      RoleSessionName: FUNCTION_NAME,
      ExternalId: FUNCTION_NAME,
      RoleArn: roleArn,
    }).promise();
    return new Credentials(AccessKeyId, SecretAccessKey, SessionToken);
  }

  /**
   * Retrieves all matched file objects from inside the "src" definition.
   * This function will resolve all matched file references, across all input
   * artifacts.
   *
   * @return {Array[File]} an array of file objects ready for upload.
   */
  async files() {
    const { artifacts, sources } = this;
    const files = sources.map(async (src) => {
      const [artifactName, glob] = src.split('::');
      const artifact = artifacts[artifactName];
      if (!artifact) {
        throw artifactNotFound({ artifactName });
      }
      await artifact.ready();
      return artifact.match(glob);
    });
    return await Promise.all(files);
  }

  /**
   * Uploads all matched files from their source input artifacts to the
   * defined destinations, prefixed with the appropriate key.
   *
   * Note that this function first assumes the correct role for this destination.
   *
   * @return {Boolean} true if successful, throws otherwise.
   */
  async upload() {
    const { prefix } = this;
    const credentials = await this.credentials();
    const bucket = await this.bucket.value();
    const files = await this.files();
    const uploads = files.map(f => f.upload({ bucket, credentials, prefix }));
    await Promise.all(uploads);
    return true;
  }
}
