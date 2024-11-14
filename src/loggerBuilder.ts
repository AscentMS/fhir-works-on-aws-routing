import { makeLogger } from '@ascentms/fhir-works-on-aws-interface';

const componentLogger = makeLogger({
    component: 'routing',
});

export default function getComponentLogger(): any {
    return componentLogger;
}
