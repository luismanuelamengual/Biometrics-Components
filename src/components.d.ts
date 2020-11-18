/* eslint-disable */
/* tslint:disable */
/**
 * This is an autogenerated file created by the Stencil compiler.
 * It contains typing information for all components that exist in this project.
 */
import { HTMLStencilElement, JSXBase } from "@stencil/core/internal";
export namespace Components {
    interface BiometricsCamera {
        "buttonStyle": 'normal' | 'classic';
        "capture": () => Promise<void>;
        "facingMode": 'environment' | 'user' | 'left' | 'right';
        "fullScreen": boolean;
        "getSnapshot": (maxWidth: number, maxHeight: number, type?: string, quality?: number) => Promise<Blob>;
        "getSnapshotImageData": (maxWidth: number, maxHeight: number) => Promise<ImageData>;
        "getSnapshotUrl": (maxWidth: number, maxHeight: number, type?: string) => Promise<string>;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "showCaptureButton": boolean;
        "showConfirmButton": boolean;
    }
    interface BiometricsLiveness {
        "apiKey": string;
        "autoStart": boolean;
        "cameraFacingMode": 'environment' | 'user' | 'left' | 'right';
        "instructionPictureQuality": number;
        "instructionTimeout": number;
        "instructions": string[];
        "maxInstructionPictureHeight": number;
        "maxInstructionPictureWidth": number;
        "maxInstructions": number;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "messages": any;
        "pictureQuality": number;
        "serverUrl": string;
        "showInitButton": boolean;
        "startSession": () => Promise<void>;
        "stopSession": () => Promise<void>;
        "timeout": number;
    }
    interface BiometricsLivenessPassive {
        "apiKey": string;
        "autoCapture": boolean;
        "autoCaptureTimeout": number;
        "faceDetectionInterval": number;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "serverUrl": string;
        "useFaceDetector": boolean;
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
        "buttonStyle"?: 'normal' | 'classic';
        "facingMode"?: 'environment' | 'user' | 'left' | 'right';
        "fullScreen"?: boolean;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "onPictureCaptured"?: (event: CustomEvent<any>) => void;
        "showCaptureButton"?: boolean;
        "showConfirmButton"?: boolean;
    }
    interface BiometricsLiveness {
        "apiKey"?: string;
        "autoStart"?: boolean;
        "cameraFacingMode"?: 'environment' | 'user' | 'left' | 'right';
        "instructionPictureQuality"?: number;
        "instructionTimeout"?: number;
        "instructions"?: string[];
        "maxInstructionPictureHeight"?: number;
        "maxInstructionPictureWidth"?: number;
        "maxInstructions"?: number;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "messages"?: any;
        "onSessionFailed"?: (event: CustomEvent<any>) => void;
        "onSessionStarted"?: (event: CustomEvent<any>) => void;
        "onSessionSucceded"?: (event: CustomEvent<any>) => void;
        "pictureQuality"?: number;
        "serverUrl"?: string;
        "showInitButton"?: boolean;
        "timeout"?: number;
    }
    interface BiometricsLivenessPassive {
        "apiKey"?: string;
        "autoCapture"?: boolean;
        "autoCaptureTimeout"?: number;
        "faceDetectionInterval"?: number;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "onLivenessVerificationComplete"?: (event: CustomEvent<any>) => void;
        "serverUrl"?: string;
        "useFaceDetector"?: boolean;
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
