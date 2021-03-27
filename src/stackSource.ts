import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { Duration } from '@aws-cdk/core';

// const queue = new sqs.Queue(this, 'MyQueue', {
//   visibilityTimeout: Duration.seconds(30),      // default,
//   receiveMessageWaitTime: Duration.seconds(20) // default
// });

// lambda.addEventSource(new SqsEventSource(queue, {
//   batchSize: 2, // default
// }));

// import * as sns from '@aws-cdk/aws-sns';
// import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';

// const topic = new sns.Topic(...);
// const deadLetterQueue = new sqs.Queue(this, 'deadLetterQueue');

// lambda.addEventSource(new SnsEventSource(topic, {
//   filterPolicy: { ... },
//   deadLetterQueue: deadLetterQueue
// }));