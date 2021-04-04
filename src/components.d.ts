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
        "maxStatusFailBuffer": number;
        "messages": any;
        "mode": 'classic' | 'mask';
        "pictureQuality": number;
        "serverUrl": string;
        "showInitButton": boolean;
        "startSession": () => Promise<void>;
        "stopSession": () => Promise<void>;
        "timeout": number;
    }
    interface BiometricsLiveness3d {
        "apiKey": string;
        "debugMode": boolean;
        "faceDetectionInterval": number;
        "faceDetectionSeconds": number;
        "maxPictureHeight": number;
        "maxPictureWidth": number;
        "serverUrl": string;
        "showStartButton": boolean;
        "startOnInit": boolean;
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
    interface HTMLBiometricsLiveness3dElement extends Components.BiometricsLiveness3d, HTMLStencilElement {
    }
    var HTMLBiometricsLiveness3dElement: {
        prototype: HTMLBiometricsLiveness3dElement;
        new (): HTMLBiometricsLiveness3dElement;
    };
    interface HTMLElementTagNameMap {
        "biometrics-camera": HTMLBiometricsCameraElement;
        "biometrics-liveness": HTMLBiometricsLivenessElement;
        "biometrics-liveness3d": HTMLBiometricsLiveness3dElement;
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
        "maxStatusFailBuffer"?: number;
        "messages"?: any;
        "mode"?: 'classic' | 'mask';
        "onSessionFailed"?: (event: CustomEvent<any>) => void;
        "onSessionStarted"?: (event: CustomEvent<any>) => void;
        "onSessionSucceded"?: (event: CustomEvent<any>) => void;
        "pictureQuality"?: number;
        "serverUrl"?: string;
        "showInitButton"?: boolean;
        "timeout"?: number;
    }
    interface BiometricsLiveness3d {
        "apiKey"?: string;
        "debugMode"?: boolean;
        "faceDetectionInterval"?: number;
        "faceDetectionSeconds"?: number;
        "maxPictureHeight"?: number;
        "maxPictureWidth"?: number;
        "onSessionFailed"?: (event: CustomEvent<any>) => void;
        "onSessionSucceded"?: (event: CustomEvent<any>) => void;
        "serverUrl"?: string;
        "showStartButton"?: boolean;
        "startOnInit"?: boolean;
    }
    interface IntrinsicElements {
        "biometrics-camera": BiometricsCamera;
        "biometrics-liveness": BiometricsLiveness;
        "biometrics-liveness3d": BiometricsLiveness3d;
    }
}
export { LocalJSX as JSX };
declare module "@stencil/core" {
    export namespace JSX {
        interface IntrinsicElements {
            "biometrics-camera": LocalJSX.BiometricsCamera & JSXBase.HTMLAttributes<HTMLBiometricsCameraElement>;
            "biometrics-liveness": LocalJSX.BiometricsLiveness & JSXBase.HTMLAttributes<HTMLBiometricsLivenessElement>;
            "biometrics-liveness3d": LocalJSX.BiometricsLiveness3d & JSXBase.HTMLAttributes<HTMLBiometricsLiveness3dElement>;
        }
    }
}
