import Ajv from 'ajv';
import typedError from 'error/typed';

import Schema from './schema';

/**
 * A validation error was encountered
 *
 * @type {Error}
 */
const validationError = typedError({
  message: 'Invalid data: {messages}',
  type: 'pipeline.validation',
});

/**
 * Build a new AJV validator isntance, ensuring that all errors are returned
 * if the data does not match the defined schema and any defined defaults are also
 * assigned to the returned data.
 */
const ajv = new Ajv({ useDefaults: true, allErrors: true });

/**
 * Compiles the raw schema object, providing a method which can be used
 * to validate against a basic javascript object.
 */
const validate = ajv.compile(Schema);

/**
 * Wraps the AJV library to provide a helper function which validates the
 * passed data object against the imported schema file.
 *
 * If the schema fails to validate, an array of error messages are generated.
 *
 * @return {Object} a mutated data object, containing any defaulted properties
 *  where defined in the schema.
 */
export default function (data) {
  return new Promise((resolve, reject) => {
    const valid = validate(data);
    if (!valid) {
      const messages = validate.errors.map(e => `Schema ${e.message}`).join('. ');
      reject(validationError({ messages }));
    } else {
      resolve(data);
    }
  });
}
