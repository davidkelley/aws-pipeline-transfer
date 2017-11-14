import { CodePipeline } from 'aws-sdk';

import { AWS_REGION } from '../globals';

import Uploader from './transfer/uploader';

const client = new CodePipeline({ region: AWS_REGION });

export async function handler(event, context, cb) {
  const pipeline = event['CodePipeline.job'];
  const { id } = pipeline;
  const result = { jobId: id };
  try {
    await new Uploader(pipeline).perform();
    await client.putJobSuccessResult(result).promise();
    cb(null, result);
  } catch (err) {
    await client.putJobFailureResult({
      failureDetails: {
        message: err.message,
        type: 'JobFailed',
      },
      ...result,
    });
    cb(err);
  }
  return result;
}
