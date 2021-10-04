import {BiometricsElement} from "../../../element";
import styles from "./index.scss";

export class BiometricsColElement extends BiometricsElement {

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-col';
    }

    protected createStyles(): string {
        return styles;
    }
}

BiometricsColElement.register();
