import typedError from 'error/typed';

import Artifact from './artifact';
import Destination from './destination';
import validate from './validate';

/**
 * A validation error was encountered
 *
 * @type {Error}
 */
const inputArtifactsError = typedError({
  message: 'No InputArtifacts defined.',
  type: 'pipeline.start',
});

export default class Uploader {
  /**
   * Uploads artifacts to a remote S3 bucket defined inside an array of file
   * globs, of locations inside pipeline input artifacts.
   *
   * @example
   * ```
   *  {
   *     "CodePipeline.job": {
   *         "id": "11111111-abcd-1111-abcd-111111abcdef",
   *         "accountId": "111111111111",
   *         "data": {
   *             "actionConfiguration": {
   *                 "configuration": {
   *                     "FunctionName": "MyLambdaFunctionForAWSCodePipeline",
   *                     "UserParameters": "...."
   *                 }
   *             },
   *             "inputArtifacts": [
   *                 {
   *                     "location": {
   *                         "s3Location": {
   *                             "bucketName": "codepipeline-us-east-2-1234567890",
   *                             "objectKey": "rj90jda90ja90j09tj09jaf.zip"
   *                         },
   *                         "type": "S3"
   *                     },
   *                     "revision": null,
   *                     "name": "ArtifactName"
   *                 }
   *             ],
   *             "outputArtifacts": [],
   *             "artifactCredentials": {
   *                 "secretAccessKey": "....",
   *                 "sessionToken": "....",
   *                 "accessKeyId": "...."
   *             },
   *             "continuationToken": "A continuation token if continuing job"
   *         }
   *     }
   *  }
   * ```
   *
   * @param {Object} data - A CodePipeline data event object.
   */
  constructor({ data }) {
    /**
     * The data object as received from AWS CodePipeline.
     *
     * @type {Object}
     */
    this.data = data;
    /**
     * The parsed contents of the `UserParameters` string as defined inside the
     * action in the CodePipeline resource. This should be a valid array of objects,
     * similar to the example below:
     *
     * ```
     * [
     * {
     *   "roleArn": {
     *     "Fn::GetParam": ["DeployOutput", "Outputs.json", "AssetS3BucketTransferRole"]
     *   },
     *   "bucket": {
     *     "Fn::GetParam": ["DeployOutput", "Outputs.json", "AssetS3Bucket"]
     *   },
     *   "prefix": "s3/key/prefix/",
     *   "src": [
     *     "BuildOutput::*.js"
     *   ]
     * }
     * ]
     * ```
     *
     * @type {Object}
     */
    this.parameters = JSON.parse(this.data.actionConfiguration.configuration.UserParameters);
    const inputs = data.inputArtifacts;
    if (!inputs || inputs.length === 0) {
      throw inputArtifactsError({});
    }
    const mapper = a => Artifact.toArtifactMapEntry(a, data.artifactCredentials);
    /**
     * An array of {@link Artifact} objects which have been made available to
     * the CodePipeline action definition.
     *
     * @type {String}
     */
    this.artifacts = inputs.map(mapper).reduce((memo, [key, val]) => {
      const obj = memo;
      obj[key] = val;
      return obj;
    }, {});
  }

  /**
   * Retrieve validated (and defaulted) parameters which have been defined inside
   * the action in the CodePipeline resource.
   *
   * @return {Object} valid parameters to be used to construct the state machine input.
   */
  async userParameters() {
    return await validate(this.parameters);
  }

  /**
   * Maps all defined src/dest combinations (from {@link Uploader#userParameters}) to
   * destination objects ready for upload.
   *
   * @return {Array[Destination]} an array of Destination objects
   */
  async destinations() {
    const { artifacts } = this;
    const params = await this.userParameters();
    return params.map(p => new Destination(p, artifacts));
  }

  /**
   * Performs the intended operation and uploads source files from pipeine
   * artifacts to remote S3 locations by assuming the provided roles to
   * provide the correct permission sets.
   *
   * The promise resolves successfully after all source files have been uploaded.
   *
   * @return {Boolean} true if successful, throws otherwise.
   */
  async perform() {
    const destinations = await this.destinations();
    return await Promise.all(destinations.map(d => d.upload()));
  }
}
