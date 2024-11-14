/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { InvalidResourceError, TypeOperation, Validator } from '@ascentms/fhir-works-on-aws-interface';
import { InvokeCommand, InvokeCommandInput, LambdaClient } from '@aws-sdk/client-lambda';
import getComponentLogger from '../../loggerBuilder';

interface ErrorMessage {
    severity: string;
    msg: string;
}

interface HapiValidatorResponse {
    errorMessages: ErrorMessage[];
    successful: boolean;
}
// a relatively high number to give cold starts a chance to succeed
const TIMEOUT_MILLISECONDS = 25_000;
const logger = getComponentLogger();

export default class HapiFhirLambdaValidator implements Validator {
    private hapiValidatorLambdaArn: string;

    private lambdaClient: LambdaClient;

    constructor(hapiValidatorLambdaArn: string) {
        this.hapiValidatorLambdaArn = hapiValidatorLambdaArn;
        this.lambdaClient = new LambdaClient({
            requestHandler: {
                requestTimeout: TIMEOUT_MILLISECONDS,
            },
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async validate(resource: any, params: { tenantId?: string; typeOperation?: TypeOperation } = {}): Promise<void> {
        const lambdaParams: InvokeCommandInput = {
            FunctionName: this.hapiValidatorLambdaArn,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(JSON.stringify(resource)),
        };

        const lambdaInvokeCommand = new InvokeCommand(lambdaParams);
        const lambdaResponse = await this.lambdaClient.send(lambdaInvokeCommand);

        if (lambdaResponse.FunctionError) {
            // this means that the lambda function crashed, not necessarily that the resource is invalid.
            const msg = `The execution of ${this.hapiValidatorLambdaArn} lambda function failed`;
            logger.error(msg, lambdaResponse);
            throw new Error(msg);
        }
        // response payload is always a string. the Payload type is also used for invoke parameters
        if (!lambdaResponse.Payload) {
            const msg = 'No payload returned from lambda function';
            logger.error(msg, lambdaResponse);
            throw new Error(msg);
        }

        const responsePayload = await lambdaResponse.Payload.transformToString();

        const hapiValidatorResponse = JSON.parse(responsePayload) as HapiValidatorResponse;
        if (hapiValidatorResponse.successful) {
            return;
        }

        const allErrorMessages = hapiValidatorResponse.errorMessages
            .filter((e) => e.severity === 'error')
            .map((e) => e.msg)
            .join('\n');

        throw new InvalidResourceError(allErrorMessages);
    }
}
