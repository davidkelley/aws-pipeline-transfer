/**
 * Defines the schema used to retrieve either statically defined values
 * or attributes from inside remote artifacts.
 *
 * @type {Object}
 */
const remoteAttribute = {
  oneOf: [
    {
      type: 'string',
    },
    {
      type: 'object',
      required: ['Fn::GetParam'],
      properties: {
        'Fn::GetParam': {
          type: 'array',
          items: [
            {
              type: 'string',
            },
            {
              type: 'string',
            },
            {
              type: 'string',
            },
          ],
        },
      },
    },
  ],
};

/**
 * This schema defines the keys, properties and valid values that can be included
 * inside the `UserParameters` key when defining the use of this action inside
 * CodePipeline.
 *
 * @type {Object}
 */
const Schema = {
  type: 'array',
  minItems: 1,
  uniqueItems: true,
  items: {
    type: 'object',
    required: ['roleArn', 'bucket', 'src'],
    properties: {
      roleArn: remoteAttribute,
      bucket: remoteAttribute,
      prefix: {
        type: 'string',
        default: '/',
      },
      cwd: {
        type: 'string',
        default: '',
      },
      src: {
        type: 'array',
        minItems: 1,
        uniqueItems: true,
        items: {
          type: 'string',
          pattern: '^.+::.+$',
        },
      },
    },
  },
};

export default Schema;
