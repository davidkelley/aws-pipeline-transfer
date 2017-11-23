import { CodePipeline } from 'aws-sdk';

import { AWS_REGION } from '../globals';

import Logger from '../logger';
import Uploader from './transfer/uploader';

const client = new CodePipeline({ region: AWS_REGION });

export async function handler(event, context, cb) {
  const externalExecutionId = context.awsRequestId;
  const pipeline = event['CodePipeline.job'];
  const { id } = pipeline;
  const result = { jobId: id };
  try {
    await new Uploader(pipeline).perform();
    result.executionDetails = { externalExecutionId };
    await client.putJobSuccessResult(result).promise();
    cb(null, result);
  } catch (err) {
    Logger.error(err);
    result.failureDetails = {
      externalExecutionId,
      message: err.message,
      type: 'JobFailed',
    };
    await client.putJobFailureResult(result).promise();
    cb(err);
  }
  return result;
}
