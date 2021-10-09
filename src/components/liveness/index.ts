import {BiometricsElement} from "../../element";
import styles from "./index.scss";
import {BiometricsCameraElement} from "../camera";

export class BiometricsLivenessElement extends BiometricsElement {

    private cameraElement: BiometricsCameraElement;
    private maskElement: HTMLDivElement;

    /**
     * @internal
     */
    constructor() {
        super(true);
    }

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-liveness';
    }

    protected createStyles(): string {
        return styles;
    }

    protected createContent(): Array<HTMLElement> {
        return [
            this.createCamera(),
            this.createMask()
        ];
    }

    protected createCamera(): BiometricsCameraElement {
        this.cameraElement = this.createElement('biometrics-camera', {
            attributes: {
                controls: 'false',
                fullscreen: 'false',
                'aspect-ratio': '1',
                'facing-mode': 'user'
            }
        });
        return this.cameraElement;
    }

    protected createMask(): HTMLDivElement {
        this.maskElement = this.createElement('div', {classes: 'mask'});
        return this.createElement('div', {classes: 'mask-container'}, [this.maskElement]);
    }
}

BiometricsLivenessElement.register();
