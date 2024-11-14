/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { InvalidResourceError } from '@ascentms/fhir-works-on-aws-interface';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';

import HapiFhirLambdaValidator from './hapiFhirLambdaValidator';
import { Uint8ArrayBlobAdapter } from '@smithy/util-stream';

const SOME_RESOURCE = 'my value does not matter because validation lambda is always mocked';
const VALIDATOR_LAMBDA_ARN = 'my value does not matter because validation lambda is always mocked';

describe('HapiFhirLambdaValidator', () => {
    const lambdaMock = mockClient(LambdaClient);

    beforeEach(() => {
        lambdaMock.reset();
    });

    afterAll(() => {
        lambdaMock.restore();
    });

    test('valid resource', async () => {
        /*
        AWSMock.mock('Lambda', 'invoke', (params: any, callback: Function) => {
            callback(null, {
                StatusCode: 200,
                Payload: JSON.stringify({
                    successful: true,
                }),
            });
        });
        */

        lambdaMock.on(InvokeCommand).resolvesOnce({
            StatusCode: 200,
            Payload: Uint8ArrayBlobAdapter.fromString(
                JSON.stringify({
                    successful: true,
                }),
            ),
        });

        const hapiFhirLambdaValidator = new HapiFhirLambdaValidator(VALIDATOR_LAMBDA_ARN);
        await expect(hapiFhirLambdaValidator.validate(SOME_RESOURCE)).resolves.toBeUndefined();
    });

    test('invalid resource', async () => {
        /*
        AWSMock.mock('Lambda', 'invoke', (params: any, callback: Function) => {
            callback(null, {
                StatusCode: 200,
                Payload: JSON.stringify({
                    errorMessages: [
                        {
                            severity: 'error',
                            msg: 'error1',
                        },
                        {
                            severity: 'error',
                            msg: 'error2',
                        },
                        {
                            severity: 'warning',
                            msg: 'warning1',
                        },
                    ],
                    successful: false,
                }),
            });
        });
        */
        lambdaMock.on(InvokeCommand).resolvesOnce({
            StatusCode: 200,
            Payload: Uint8ArrayBlobAdapter.fromString(
                JSON.stringify({
                    errorMessages: [
                        {
                            severity: 'error',
                            msg: 'error1',
                        },
                        {
                            severity: 'error',
                            msg: 'error2',
                        },
                        {
                            severity: 'warning',
                            msg: 'warning1',
                        },
                    ],
                    successful: false,
                }),
            ),
        });

        const hapiFhirLambdaValidator = new HapiFhirLambdaValidator(VALIDATOR_LAMBDA_ARN);
        await expect(hapiFhirLambdaValidator.validate(SOME_RESOURCE)).rejects.toThrowError(
            new InvalidResourceError('error1\nerror2'),
        );
    });

    test('lambda execution fails', async () => {
        /*
        AWSMock.mock('Lambda', 'invoke', (params: any, callback: Function) => {
            callback(null, {
                StatusCode: 200,
                FunctionError: 'unhandled',
                Payload: 'some error msg',
            });
        });
        */
        lambdaMock.on(InvokeCommand).resolvesOnce({
            StatusCode: 200,
            FunctionError: 'unhandled',
            Payload: Uint8ArrayBlobAdapter.fromString('some error msg'),
        });
        
        const hapiFhirLambdaValidator = new HapiFhirLambdaValidator(VALIDATOR_LAMBDA_ARN);
        await expect(hapiFhirLambdaValidator.validate(SOME_RESOURCE)).rejects.toThrow('lambda function failed');
    });
});
