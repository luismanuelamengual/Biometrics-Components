import {BiometricsElement} from "../../element";

export class BiometricsLivenessElement extends BiometricsElement {

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
}

BiometricsLivenessElement.register();
