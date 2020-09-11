/* eslint-disable */
/* tslint:disable */
/**
 * This is an autogenerated file created by the Stencil compiler.
 * It contains typing information for all components that exist in this project.
 */
import { HTMLStencilElement, JSXBase } from "@stencil/core/internal";
export namespace Components {
    interface BiometricsCamera {
        "facingMode": "environment" | "user" | "left" | "right";
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "type": "classic" | "fullscreen";
    }
    interface BiometricsLiveness {
        "apiKey": string;
        "autoStart": boolean;
        "instructions": string[];
        "maxInstructions": number;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "messages": any;
        "serverUrl": string;
        "showInitButton": boolean;
        "startSession": () => Promise<void>;
        "stopSession": () => Promise<void>;
        "timeout": number;
    }
    interface BiometricsLivenessPassive {
        "apiKey": string;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "serverUrl": string;
    }
}
declare global {
    interface HTMLBiometricsCameraElement extends Components.BiometricsCamera, HTMLStencilElement {
    }
    var HTMLBiometricsCameraElement: {
        prototype: HTMLBiometricsCameraElement;
        new (): HTMLBiometricsCameraElement;
    };
    interface HTMLBiometricsLivenessElement extends Components.BiometricsLiveness, HTMLStencilElement {
    }
    var HTMLBiometricsLivenessElement: {
        prototype: HTMLBiometricsLivenessElement;
        new (): HTMLBiometricsLivenessElement;
    };
    interface HTMLBiometricsLivenessPassiveElement extends Components.BiometricsLivenessPassive, HTMLStencilElement {
    }
    var HTMLBiometricsLivenessPassiveElement: {
        prototype: HTMLBiometricsLivenessPassiveElement;
        new (): HTMLBiometricsLivenessPassiveElement;
    };
    interface HTMLElementTagNameMap {
        "biometrics-camera": HTMLBiometricsCameraElement;
        "biometrics-liveness": HTMLBiometricsLivenessElement;
        "biometrics-liveness-passive": HTMLBiometricsLivenessPassiveElement;
    }
}
declare namespace LocalJSX {
    interface BiometricsCamera {
        "facingMode"?: "environment" | "user" | "left" | "right";
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "onPictureCaptured"?: (event: CustomEvent<any>) => void;
        "type"?: "classic" | "fullscreen";
    }
    interface BiometricsLiveness {
        "apiKey"?: string;
        "autoStart"?: boolean;
        "instructions"?: string[];
        "maxInstructions"?: number;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "messages"?: any;
        "onInitialized"?: (event: CustomEvent<any>) => void;
        "onSessionCompleted"?: (event: CustomEvent<any>) => void;
        "onSessionEnded"?: (event: CustomEvent<any>) => void;
        "onSessionStarted"?: (event: CustomEvent<any>) => void;
        "serverUrl"?: string;
        "showInitButton"?: boolean;
        "timeout"?: number;
    }
    interface BiometricsLivenessPassive {
        "apiKey"?: string;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "onLivenessVerificationComplete"?: (event: CustomEvent<any>) => void;
        "serverUrl"?: string;
    }
    interface IntrinsicElements {
        "biometrics-camera": BiometricsCamera;
        "biometrics-liveness": BiometricsLiveness;
        "biometrics-liveness-passive": BiometricsLivenessPassive;
    }
}
export { LocalJSX as JSX };
declare module "@stencil/core" {
    export namespace JSX {
        interface IntrinsicElements {
            "biometrics-camera": LocalJSX.BiometricsCamera & JSXBase.HTMLAttributes<HTMLBiometricsCameraElement>;
            "biometrics-liveness": LocalJSX.BiometricsLiveness & JSXBase.HTMLAttributes<HTMLBiometricsLivenessElement>;
            "biometrics-liveness-passive": LocalJSX.BiometricsLivenessPassive & JSXBase.HTMLAttributes<HTMLBiometricsLivenessPassiveElement>;
        }
    }
}
