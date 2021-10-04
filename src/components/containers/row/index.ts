import {BiometricsElement} from "../../../element";
import styles from "./index.scss";

export class BiometricsRowElement extends BiometricsElement {

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-row';
    }

    protected createStyles(): string {
        return styles;
    }
}

BiometricsRowElement.register();
