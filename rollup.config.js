import {terser} from 'rollup-plugin-terser';
import nodeResolve from "@rollup/plugin-node-resolve";

const plugins = [
    nodeResolve(),
    terser({
        module: true,
        keep_classnames: true
    }),
];

export default [
    {
        input: 'dist/index.js',
        output: {
            sourcemap: true,
            format: 'es',
            file: 'dist/biometrics-components.bundle.js',
            name: 'BiometricsComponents'
        },
        plugins: plugins,
        onwarn: (warning, warn) => {}
    }
];
