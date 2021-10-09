import {BiometricsElement} from "../../element";
import styles from "./index.scss";

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

    protected createStyles(): string {
        return styles;
    }
}

BiometricsLivenessElement.register();
