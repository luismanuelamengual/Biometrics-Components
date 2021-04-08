import {Config} from '@stencil/core';
import {sass} from "@stencil/sass";
import { readFileSync } from 'fs';

export const config: Config = {
    namespace: 'biometrics-components',
    plugins: [
        sass()
    ],
    outputTargets: [
        {
            type: 'dist',
            esmLoaderPath: '../loader'
        },
        {
            type: 'docs-readme'
        },
        {
            type: 'www',
            serviceWorker: null // disable service workers
        }
    ],
    devServer: {
        reloadStrategy: 'pageReload',
        https: {
            cert: readFileSync('cert.pem', 'utf8'),
            key: readFileSync('key.pem', 'utf8')
        }
    }
};
