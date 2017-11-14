import wrappedError from 'error/wrapped';
import typedError from 'error/typed';

/**
 * An unsupported parameter value object was encountered.
 *
 * @type {Error}
 */
const artifactParameterError = typedError({
  message: 'Unsupported object key "{keys}"',
  type: 'pipeline.attribute',
});

/**
 * The remote artifact file did not contain a truthy key value.
 *
 * @type {Error}
 */
const remoteArtifactValueError = wrappedError({
  message: 'Value was null or undefined for "{path}"',
  type: 'pipeline.attribute.artifact.value',
});

/**
 * The defined remote artifact does not exist or access has not been granted.
 *
 * @type {Error}
 */
const artifactNotFound = typedError({
  message: 'Artifact "{artifactName}" was referenced, but is not a valid InputArtifact.',
  type: 'pipeline.attribute.artifact.not_found',
});

/**
 * Indicates a remote artifact type
 *
 * @type {String}
 */
const REMOTE = 'REMOTE';

/**
 * Indicates a static artifact type
 *
 * @type {String}
 */
const STATIC = 'STATIC';

/**
 * Resolves an attribute that has been defined as part of the UserParameters.
 * An attribute can either be a static, hardcoded value or can be a reference
 * to a key, found inside a file present in an input artifact.
 */
export default class Attribute {
  /**
   * @param {String,Object} mapping - a mapping object, either a hardcoded value
   *  or a reference to a key, found inside a file present in an input artifact.
   * @param {Array[Artifact]} artifacts - an array of artifacts that any remote
   *  attribute value could be found inside.
   */
  constructor(mapping, artifacts) {
    /**
     * Either a hardcoded value (a string) or an object denoting a remote reference.
     *
     * @type {String,Object}
     */
    this.mapping = mapping;
    /**
     * An object containing {@link Artifact} instances, with the keys denoting
     * the logical name of the artifact inside CodePipeline.
     *
     * @type {Array[Artifact]}
     */
    this.artifacts = artifacts;
  }

  /**
   * Determine if the type of mapping that has been provided for the attribute
   * value is either a static value, or needs to be resolved using a remote
   * input artifact.
   *
   * @return {String} the type of attribute mapping provided
   */
  get type() {
    const { mapping } = this;
    if (typeof mapping !== 'string') {
      return REMOTE;
    }
    return STATIC;
  }

  /**
   * Resolves the value for the attribute, either returning the static attribute
   * value, or the resolved value from inside a remote artifact.
   *
   * @return {String} the attribute's value
   */
  async value() {
    const { type, mapping } = this;
    if (type === STATIC) {
      return mapping;
    }
    const properties = mapping['Fn::GetArtifactAtt'];
    if (!properties) {
      const keys = Object.keys(mapping).join(', ');
      throw artifactParameterError({ keys });
    }
    return await this.fetch(...properties);
  }

  /**
   * @private
   *
   * Fetch the value of a specific parameter using the key found inside a json file
   * inside the specific artifact.
   *
   * @param {String} artifactName - the name of the artifact the file resides in.
   * @param {String} filename - The name of the JSON file inside the artifact
   * @param {String} key - The property key inside the JSON file
   *
   * @return {String} the value of the key inside the JSON file, inside the artifact.
   */
  async fetch(artifactName, filename, key) {
    const artifact = this.artifacts[artifactName];
    if (!artifact) {
      throw artifactNotFound({ artifactName });
    } else {
      await artifact.ready();
      const value = artifact.attribute(filename, key);
      if (!value) {
        throw remoteArtifactValueError({
          path: `${artifactName}::${filename}::${key}`,
        });
      } else {
        return value;
      }
    }
  }
}
