import {BiometricsElement} from "../../../element";
import styles from "./index.scss";

export class BiometricsContainerElement extends BiometricsElement {

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-container';
    }

    protected createStyles(): string {
        return styles;
    }
}

BiometricsContainerElement.register();
