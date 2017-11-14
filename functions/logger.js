import Bunyan from 'bunyan';

import { LOG_LEVEL } from './globals';

/**
 * Custom serializer for errors that are thrown by the Error library
 * that this function utilizes.
 */
const ErrorSerializer = (err) => {
  const { message, name, type, origMessage, code = {} } = err;
  return { message, name, type, origMessage, detail: code };
};

/**
 * The options that the logger is initialised with.
 *
 * @see https://github.com/trentm/node-bunyan
 */
const options = {
  name: 'pipeline-transfer',
  level: LOG_LEVEL,
  serializers: {
    err: ErrorSerializer,
  },
};

/**
 * @external {Logger} https://github.com/trentm/node-bunyan
 */
const Logger = Bunyan.createLogger(options);

export default Logger;
