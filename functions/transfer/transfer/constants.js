/**
 * Retrieves the name of the AWS Lambda function from the Lambda execution
 * environment variables.
 *
 * @type {String}
 */
export const FUNCTION_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || 'default';
