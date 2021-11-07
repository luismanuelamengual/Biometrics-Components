import {BiometricsElement} from "../../element";
import styles from "./index.scss";
import {BiometricsCameraElement} from "../camera";
import {Detector, FrontalFaceClassifier} from "cascade-classifier-detector";
import {BiometricsAnimationElement} from "../animation";
import loadingAnimationData from './animations/loading-animation-data';
import successAnimationData from './animations/success-animation-data';
import failureAnimationData from './animations/failure-animation-data';
import {MaskMode} from "./mask-mode";
import {CodeError, LivenessApi, convertBlobToImageUrl} from "biometrics-core";

export class BiometricsLivenessElement extends BiometricsElement {

    public static readonly SUCCESS_STATUS_CODE = 0;
    public static readonly FAILED_STATUS_CODE = 1;
    public static readonly CONNECTION_FAILED_STATUS_CODE = 2;
    public static readonly AUTHORIZATION_FAILED_STATUS_CODE = 3;
    public static readonly TIMEOUT_STATUS_CODE = 4;
    public static readonly CAMERA_FAILURE_STATUS_CODE = 5
    public static readonly ANOMALY_DETECTED_STATUS_CODE = 6;
    public static readonly ABRUPT_CLOSE_STATUS_CODE = 7;

    public static readonly SESSION_STARTED_EVENT = 'sessionStarted';
    public static readonly SESSION_ENDED_EVENT = 'sessionEnded';
    public static readonly SESSION_SUCCESS_EVENT = 'sessionSuccess';
    public static readonly SESSION_FAIL_EVENT = 'sessionFail';

    private static readonly MIN_FACE_DISTANCE_TO_CENTER_PERCENTAGE = 6;
    private static readonly MIN_FACE_SCALE_PERCENTAGE = 40;
    private static readonly MAX_FACE_SCALE_PERCENTAGE = 55;
    private static readonly MIN_ZOOMED_FACE_SCALE_PERCENTAGE = 60;
    private static readonly MAX_ZOOMED_FACE_SCALE_PERCENTAGE = 75;
    private static readonly DEFAULT_DETECTION_INTERVAL = 100;
    private static readonly DEFAULT_CAPTURE_DELAY_SECONDS = 2;
    private static readonly DEFAULT_TIMEOUT_SECONDS = 30;
    private static readonly DEFAULT_MAX_VIDEO_RESOLUTION = 720;
    private static readonly FACE_ASPECT_RATIO = 0.73333;

    private _caption = '';
    private _showStartButton = false;
    private _showRetryButton = false;
    private _showCamera = false;
    private _showMask = false;
    private _showFaceIndicator = false;
    private _faceRect: DOMRect = null;
    private _faceMaskMode: MaskMode = MaskMode.NORMAL;
    private _faceZoomMode = false;
    private _faceDetectionRunning = false;
    private _anomalyDetectionRunning = false;
    private _sessionRunning = false;
    private _picture: Blob = null;
    private _zoomedPicture: Blob = null;
    private _previewPicture: string = null;

    private _api: LivenessApi;
    private _detector: Detector;
    private _cameraElement: BiometricsCameraElement;
    private _maskElement: HTMLElement;
    private _faceIndicatorElement: HTMLDivElement;
    private _captionElement: HTMLParagraphElement;
    private _previewPictureElement: HTMLImageElement;
    private _animationElement: BiometricsAnimationElement;
    private _timerElement: HTMLDivElement;
    private _faceDetectionTask: any;
    private _faceDetectionTimeoutTask: any;
    private _faceCaptureTask: any;

    constructor() {
        super(true);
        this._api = new LivenessApi();
        this._detector = new Detector(FrontalFaceClassifier, {memoryBufferEnabled: true});
        this.onSessionTimeout = this.onSessionTimeout.bind(this);
        this.onSessionAnomalyDetected = this.onSessionAnomalyDetected.bind(this);
        this.onCameraNotDetected = this.onCameraNotDetected.bind(this);
        this.onCameraDisconnected = this.onCameraDisconnected.bind(this);
    }

    protected onConnected() {
        if (this.hasAttribute('server-url')) {
            this.serverUrl = this.getAttribute('server-url');
        }
        if (this.hasAttribute('api-key')) {
            this.apiKey = this.getAttribute('api-key');
        }
        this.showStartButton = true;
    }

    protected onDisconnected() {
        this.endSession(BiometricsLivenessElement.ABRUPT_CLOSE_STATUS_CODE);
    }

    public static getTagName(): string {
        return 'biometrics-liveness';
    }

    protected createStyles(): string {
        return styles;
    }

    public get serverUrl(): string {
        return this._api.baseUrl;
    }

    public set serverUrl(serverUrl: string) {
        this._api.baseUrl = serverUrl;
    }

    public get apiKey(): string {
        return this._api.apiKey;
    }

    public set apiKey(apiKey: string) {
        this._api.apiKey = apiKey;
    }

    public get faceIndicatorEnabled(): boolean {
        return this.getAttribute('face-indicator-enabled') === 'true';
    }

    public set faceIndicatorEnabled(faceIndicatorEnabled: boolean) {
        this.setAttribute('face-indicator-enabled', String(faceIndicatorEnabled));
    }

    public get anomalyDetectionEnabled(): boolean {
        return !this.hasAttribute('anomaly-detection-enabled') || this.getAttribute('anomaly-detection-enabled') === 'true';
    }

    public set anomalyDetectionEnabled(anomalyDetectionEnabled: boolean) {
        this.setAttribute('anomaly-detection-enabled', String(anomalyDetectionEnabled));
    }

    public get detectionInterval(): number {
        return this.hasAttribute('detection-interval')? parseInt(this.getAttribute('detection-interval')) : BiometricsLivenessElement.DEFAULT_DETECTION_INTERVAL;
    }

    public set detectionInterval(detectionInterval: number) {
        this.setAttribute('detection-interval', String(detectionInterval));
    }

    public get captureDelaySeconds(): number {
        return this.hasAttribute('capture-delay-seconds')? parseInt(this.getAttribute('capture-delay-seconds')) : BiometricsLivenessElement.DEFAULT_CAPTURE_DELAY_SECONDS;
    }

    public set captureDelaySeconds(captureDelaySeconds: number) {
        this.setAttribute('capture-delay-seconds', String(captureDelaySeconds));
    }

    public get timeoutSeconds(): number {
        return this.hasAttribute('timeout-seconds')? parseInt(this.getAttribute('capture-delay-seconds')) : BiometricsLivenessElement.DEFAULT_TIMEOUT_SECONDS;
    }

    public set timeoutSeconds(timeoutSeconds: number) {
        this.setAttribute('timeout-seconds', String(timeoutSeconds));
    }

    private get sessionRunning(): boolean {
        return this._sessionRunning;
    }

    private set sessionRunning(sessionRunning: boolean) {
        if (this._sessionRunning != sessionRunning) {
            this._sessionRunning = sessionRunning;
            if (this._sessionRunning) {
                this.triggerEvent(BiometricsLivenessElement.SESSION_STARTED_EVENT);
            } else {
                this.triggerEvent(BiometricsLivenessElement.SESSION_ENDED_EVENT);
            }
        }
    }

    private get caption(): string {
        return this._caption;
    }

    private set caption(caption: string) {
        if (caption != this._caption) {
            this._caption = caption;
            if (this._caption) {
                if (!this._captionElement) {
                    this._captionElement = this.createElement('p', {classes: 'caption'}, caption);
                    this.appendElement(this.createElement('div', {classes: 'caption-container'}, [this._captionElement]));
                } else {
                    this._captionElement.innerHTML = caption;
                }
            } else {
                if (this._captionElement) {
                    this.findElement('.caption-container').remove();
                    this._captionElement = null;
                }
            }
        }
    }

    private get showStartButton(): boolean {
        return this._showStartButton;
    }

    private set showStartButton(showStartButton: boolean) {
        if (showStartButton != this._showStartButton) {
            this._showStartButton = showStartButton;
            if (this._showStartButton) {
                this.appendElement(this.createElement('button', {
                    classes: ['start-button'],
                    listeners: {
                        click: () => this.startSession()
                    }
                }, 'INICIAR'));
            } else {
                this.findElement('.start-button').remove();
            }
        }
    }

    private get showRetryButton(): boolean {
        return this._showRetryButton;
    }

    private set showRetryButton(showRetryButton: boolean) {
        if (showRetryButton != this._showRetryButton) {
            this._showRetryButton = showRetryButton;
            if (this._showRetryButton) {
                this.appendElement(this.createElement('button', {
                    classes: ['retry-button'],
                    listeners: {
                        click: () => this.startSession()
                    }
                }, 'INICIAR'));
            } else {
                this.findElement('.retry-button').remove();
            }
        }
    }

    private get showCamera(): boolean {
        return this._showCamera;
    }

    private set showCamera(showCamera: boolean) {
        if (showCamera != this._showCamera) {
            this._showCamera = showCamera;
            if (this._showCamera) {
                this._cameraElement = this.createElement('biometrics-camera', {
                    attributes: {
                        controls: 'false',
                        fullscreen: 'false',
                        'aspect-ratio': '1',
                        'facing-mode': 'user',
                        'video-width': BiometricsLivenessElement.DEFAULT_MAX_VIDEO_RESOLUTION,
                        'video-height': BiometricsLivenessElement.DEFAULT_MAX_VIDEO_RESOLUTION
                    },
                    listeners: {
                        [BiometricsCameraElement.CAMERA_NOT_DETECTED_EVENT]: this.onCameraNotDetected,
                        [BiometricsCameraElement.CAMERA_DISCONNECTED_EVENT]: this.onCameraDisconnected
                    }
                });
                this.appendElement(this._cameraElement);
            } else {
                this._cameraElement.remove();
                this._cameraElement = null;
            }
        }
    }

    private get showMask(): boolean {
        return this._showMask;
    }

    private set showMask(showMask: boolean) {
        if (showMask != this._showMask) {
            this._showMask = showMask;
            if (this._showMask) {
                this._maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement;
                this._maskElement.classList.add('mask');
                if (this._faceMaskMode === MaskMode.SUCCESS) {
                    this._maskElement.classList.add('mask-match');
                } else if (this._faceMaskMode === MaskMode.FAILURE) {
                    this._maskElement.classList.add('mask-no-match');
                }
                if (this.faceZoomMode) {
                    this._maskElement.classList.add('mask-zoom');
                }
                this._maskElement.setAttribute('viewBox', '0 0 1000 1000');
                this._maskElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                const faceWidth = 220;
                const faceHeight = Math.round(faceWidth / BiometricsLivenessElement.FACE_ASPECT_RATIO);
                this._maskElement.innerHTML = `
                    <defs><mask id="faceMask"><rect width="1000" height="1000" fill="white"></rect><ellipse fill="black" stroke="none" cx="500" cy="500" rx="${faceWidth}" ry="${faceHeight}"></ellipse></mask></defs>
                    <rect class="mask-background" width="1000" height="1000" mask="url(#faceMask)"></rect>
                    <ellipse class="mask-siluette" cx="500" cy="500" rx="${faceWidth}" ry="${faceHeight}"></ellipse>
                `;
                this.appendElement(this._maskElement);
            } else {
                this._maskElement.remove();
                this._maskElement = null;
            }
        }
    }

    private get showFaceIndicator(): boolean {
        return this._showFaceIndicator;
    }

    private set showFaceIndicator(showFaceIndicator: boolean) {
        if (showFaceIndicator != this._showFaceIndicator) {
            this._showFaceIndicator = showFaceIndicator;
            if (this._showFaceIndicator) {
                this._faceIndicatorElement = this.createElement('div', {classes: 'face-indicator'});
                this.appendElement(this._faceIndicatorElement);
            } else {
                this._faceIndicatorElement.remove();
                this._faceIndicatorElement = null;
            }
        }
    }

    private get faceRect(): DOMRect {
        return this._faceRect;
    }

    private set faceRect(rect: DOMRect) {
        this._faceRect = rect;
        if (this._faceIndicatorElement) {
            if (this._faceRect) {
                const faceWidth = this._faceRect.width * 0.9;
                const faceHeight = faceWidth / BiometricsLivenessElement.FACE_ASPECT_RATIO;
                const faceLeft = this._faceRect.left + (this._faceRect.width - faceWidth) / 2;
                const faceTop = this._faceRect.top + (this._faceRect.height - faceHeight) / 2;
                this._faceIndicatorElement.style.left = faceLeft+ 'px';
                this._faceIndicatorElement.style.top = faceTop + 'px';
                this._faceIndicatorElement.style.width = faceWidth + 'px';
                this._faceIndicatorElement.style.height = faceHeight + 'px';
                this._faceIndicatorElement.style.visibility = "visible";
            } else {
                this._faceIndicatorElement.style.visibility = "hidden";
            }
        }
    }

    private get faceMaskMode(): MaskMode {
        return this._faceMaskMode;
    }

    private set faceMaskMode(faceMaskMode: number) {
        if (this._faceMaskMode != faceMaskMode) {
            this._faceMaskMode = faceMaskMode;
            if (this._maskElement) {
                if (this._faceMaskMode === MaskMode.SUCCESS) {
                    this._maskElement.classList.add('mask-match');
                } else {
                    this._maskElement.classList.remove('mask-match');
                }
                if (this._faceMaskMode === MaskMode.FAILURE) {
                    this._maskElement.classList.add('mask-no-match');
                } else {
                    this._maskElement.classList.remove('mask-no-match');
                }
            }
        }
    }

    private get faceZoomMode(): boolean {
        return this._faceZoomMode;
    }

    private set faceZoomMode(faceZoomMode: boolean) {
        if (this._faceZoomMode != faceZoomMode) {
            this._faceZoomMode = faceZoomMode;
            if (this._maskElement) {
                if (this._faceZoomMode) {
                    this._maskElement.classList.add('mask-zoom');
                } else {
                    this._maskElement.classList.remove('mask-zoom');
                }
            }
        }
    }

    private get picture(): Blob {
        return this._picture;
    }

    private set picture(picture: Blob) {
        if (picture != this._picture) {
            this._picture = picture;
        }
    }

    private get zoomedPicture(): Blob {
        return this._zoomedPicture;
    }

    private set zoomedPicture(zoomedPicture: Blob) {
        if (zoomedPicture != this._zoomedPicture) {
            this._zoomedPicture = zoomedPicture;
        }
    }

    private get previewPicture(): string {
        return this._previewPicture;
    }

    private set previewPicture(previewPicture: string) {
        if (previewPicture != this._previewPicture) {
            this._previewPicture = previewPicture;
            if (this._previewPicture) {
                if (this._previewPictureElement) {
                    this._previewPictureElement.setAttribute('src', previewPicture);
                } else {
                    this._previewPictureElement = this.createElement('img', {classes: 'preview-picture', attributes: {src: previewPicture}});
                    this.appendElement(this._previewPictureElement);
                }
            } else {
                this._previewPictureElement.remove();
                this._previewPictureElement = null;
            }
        }
    }

    private async detectFace(): Promise<DOMRect> {
        let faceRect: DOMRect = null;
        if (this._cameraElement) {
            const imageData = await this._cameraElement.getSnapshotImageData (320, 320);
            if (imageData != null) {
                const imageWidth = imageData.width;
                const imageHeight = imageData.height;
                const elementWidth = this.offsetWidth;
                const elementHeight = this.offsetHeight;
                const cameraSize = Math.min(elementHeight, elementWidth);
                const imageXFactor = cameraSize / imageWidth;
                const imageYFactor = cameraSize / imageHeight;
                let detectedItems = this._detector.detect(imageData);
                if (detectedItems && detectedItems.length == 1) {
                    const detectedItem = detectedItems[0];
                    const radius = detectedItem.radius * imageXFactor;
                    const diameter = radius * 2;
                    const centerX = ((elementWidth / 2) - (cameraSize / 2)) + detectedItem.center.x * imageXFactor;
                    const centerY = ((elementHeight / 2) - (cameraSize / 2)) + detectedItem.center.y * imageYFactor + (radius * 0.2);
                    faceRect = new DOMRect(centerX - radius,centerY - radius, diameter, diameter);
                }
            }
        }
        return faceRect;
    }

    private async executeFaceDetection() {
        let faceMatching = true;
        let caption = 'Aguarde un momento ...';
        const faceRect = await this.detectFace();
        if (this._faceDetectionRunning) {
            if (!faceRect) {
                faceMatching = false;
                caption = 'Rostro no encontrado';
            } else {
                const elementWidth = this.offsetWidth;
                const elementHeight = this.offsetHeight;
                const elementSize = Math.min(elementWidth, elementHeight);
                const elementCenterX = elementWidth / 2;
                const elementCenterY = elementHeight / 2;
                const faceCenterX = faceRect.x + (faceRect.width / 2);
                const faceCenterY = faceRect.y + (faceRect.height / 2);
                const distanceToCenterInPixels = Math.sqrt(Math.pow(elementCenterX - faceCenterX, 2) + Math.pow(elementCenterY - faceCenterY, 2));
                const distanceToCenterInPercentage = distanceToCenterInPixels * 100 / elementSize;
                if (distanceToCenterInPercentage > BiometricsLivenessElement.MIN_FACE_DISTANCE_TO_CENTER_PERCENTAGE) {
                    faceMatching = false;
                    caption = 'Rostro no centrado';
                } else {
                    const minFaceScalePercentage = this.faceZoomMode ? BiometricsLivenessElement.MIN_ZOOMED_FACE_SCALE_PERCENTAGE : BiometricsLivenessElement.MIN_FACE_SCALE_PERCENTAGE;
                    const maxFaceScalePercentage = this.faceZoomMode ? BiometricsLivenessElement.MAX_ZOOMED_FACE_SCALE_PERCENTAGE : BiometricsLivenessElement.MAX_FACE_SCALE_PERCENTAGE;
                    const faceScaleInPercentage = faceRect.width * 100 / elementSize;
                    if (faceScaleInPercentage < minFaceScalePercentage) {
                        faceMatching = false;
                        caption = 'El rostro está demasiado lejos';
                    } else if (faceScaleInPercentage > maxFaceScalePercentage) {
                        faceMatching = false;
                        caption = 'El rostro está demasiado cerca';
                    }
                }
            }
            this.faceMaskMode = faceMatching? MaskMode.SUCCESS : MaskMode.FAILURE;
            this.caption = caption;
            this.faceRect = faceRect;
            if (faceMatching) {
                this.startFaceCaptureTimer();
            } else {
                this.stopFaceCaptureTimer();
            }
        }
    }

    private stopFaceDetection() {
        if (this._faceDetectionRunning) {
            this._faceDetectionRunning = false;
            if (this._faceDetectionTask) {
                clearTimeout(this._faceDetectionTask);
                this._faceDetectionTask = null;
            }
            this.stopFaceCaptureTimer();
            this.stopFaceDetectionTimer();
            this.showFaceIndicator = false;
        }
    }

    private async startFaceDetection() {
        if (!this._faceDetectionRunning) {
            this._faceDetectionRunning = true;
            if (this.faceIndicatorEnabled) {
                this.showFaceIndicator = true;
            }
            const faceExecutionTask = async () => {
                await this.executeFaceDetection();
                if (this._faceDetectionRunning) {
                    if (this._faceDetectionTask) {
                        clearTimeout(this._faceDetectionTask);
                        this._faceDetectionTask = null;
                    }
                    this._faceDetectionTask = setTimeout(() => this._faceDetectionRunning && faceExecutionTask(), this.detectionInterval);
                }
            }
            await faceExecutionTask();
            this.startFaceDetectionTimer();
        }
    }

    private stopFaceDetectionTimer() {
        if (this._faceDetectionTimeoutTask) {
            clearTimeout(this._faceDetectionTimeoutTask);
            this._faceDetectionTimeoutTask = null;
        }
    }

    private startFaceDetectionTimer() {
        this.stopFaceDetectionTimer();
        if (this.timeoutSeconds > 0) {
            this._faceDetectionTimeoutTask = setTimeout(this.onSessionTimeout, this.timeoutSeconds * 1000);
        }
    }

    private removeAnimation() {
        if (this._animationElement) {
            this._animationElement.remove();
            this._animationElement = null;
        }
    }

    private playAnimation(animationData: object, loop = true, onComplete: () => void | null = null) {
        if (!this._animationElement) {
            this._animationElement = this.createElement('biometrics-animation', {classes: 'animation'});
            this.appendElement(this._animationElement);
        } else {
            this._animationElement.stop();
        }
        setTimeout(() => {
            this._animationElement.src = animationData;
            this._animationElement.loop = loop;
            this._animationElement.onComplete = onComplete;
            this._animationElement.play();
        }, 100);
    }

    private playLoadingAnimation() {
        this.playAnimation(loadingAnimationData, true);
    }

    private playSuccessAnimation(onComplete: () => void | null = null) {
        this.playAnimation(successAnimationData, false, onComplete);
    }

    private playFailureAnimation(onComplete: () => void | null = null) {
        this.playAnimation(failureAnimationData, false, onComplete);
    }

    private stopFaceCaptureTimer() {
        if (this._faceCaptureTask) {
            clearInterval(this._faceCaptureTask);
            this._faceCaptureTask = null;
        }
        if (this._timerElement) {
            this._timerElement.remove();
            this._timerElement = null;
        }
    }

    private startFaceCaptureTimer() {
        if (!this._faceCaptureTask) {
            let remainingSeconds = this.captureDelaySeconds;
            this._timerElement = this.createElement('div', {classes: 'timer'}, '');
            this.appendElement(this._timerElement);
            this._timerElement.innerText = remainingSeconds.toString();
            this._faceCaptureTask = setInterval(async () => {
                remainingSeconds--;
                if (remainingSeconds > 0) {
                    this._timerElement.innerText = remainingSeconds.toString();
                } else {
                    this._timerElement.innerText = '';
                    if (remainingSeconds === 0) {
                        await this.onPictureCaptured(await this._cameraElement.getSnapshotBlob(BiometricsLivenessElement.DEFAULT_MAX_VIDEO_RESOLUTION, BiometricsLivenessElement.DEFAULT_MAX_VIDEO_RESOLUTION));
                    } 
                    if (remainingSeconds < 0) {
                        this.stopFaceCaptureTimer();
                    }
                }
            }, 1000);
        }
    }

    private startAnomalyDetection() {
        if (!this._anomalyDetectionRunning) {
            window.addEventListener('focusin', this.onSessionAnomalyDetected);
            window.addEventListener('focusout', this.onSessionAnomalyDetected);
            window.addEventListener('blur', this.onSessionAnomalyDetected);
            this._anomalyDetectionRunning = true;
        }
    }

    private stopAnomalyDetection() {
        if (this._anomalyDetectionRunning) {
            window.removeEventListener('focusin', this.onSessionAnomalyDetected);
            window.removeEventListener('focusout', this.onSessionAnomalyDetected);
            window.removeEventListener('blur', this.onSessionAnomalyDetected);
            this._anomalyDetectionRunning = false;
        }
    }

    private async onPictureCaptured(picture: Blob) {
        if (!this.picture) {
            this.picture = picture;
            this.faceZoomMode = true;
        } else if (!this.zoomedPicture) {
            this.zoomedPicture = picture;
            await this.onPicturesCaptured();
        }
    }

    private async onPicturesCaptured() {
        this.stopFaceDetection();
        this.previewPicture = await convertBlobToImageUrl(this.zoomedPicture);
        this.showCamera = false;
        this.caption = 'Analizando ...';
        this.faceMaskMode = MaskMode.NORMAL;
        this.playLoadingAnimation();
        try {
            let response;
            try {
                response = await this._api.verifyLiveness(this.picture, this.zoomedPicture);
            } catch (e) {
                if (e.code && (e.code === LivenessApi.AUTHORIZATION_KEY_MISSING_ERROR_CODE || e.code === LivenessApi.AUTHORIZATION_FAILED_ERROR_CODE)) {
                    throw new CodeError(BiometricsLivenessElement.AUTHORIZATION_FAILED_STATUS_CODE, 'Error de autenticación con el servidor');
                } else {
                    throw new CodeError(BiometricsLivenessElement.CONNECTION_FAILED_STATUS_CODE, 'Error de comunicación con el servidor');
                }
            }
            if (!response || !response.liveness) {
                throw new CodeError(BiometricsLivenessElement.FAILED_STATUS_CODE, 'No se superó la prueba de vida');
            }
            this.endSession(BiometricsLivenessElement.SUCCESS_STATUS_CODE, 'Prueba de vida superada exitosamente');
        } catch (e) {
            this.endSession(e.code, e.message);
        }
    }

    private onCameraNotDetected() {
        this.endSession(BiometricsLivenessElement.CAMERA_FAILURE_STATUS_CODE, 'No se detectó cámara web');
    }

    private onCameraDisconnected() {
        this.endSession(BiometricsLivenessElement.CAMERA_FAILURE_STATUS_CODE, 'Se desconectó la cámara web');
    }

    private onSessionAnomalyDetected() {
        this.endSession(BiometricsLivenessElement.ANOMALY_DETECTED_STATUS_CODE, 'La sesión ha sido cerrada por seguridad');
    }

    private onSessionTimeout() {
        this.endSession(BiometricsLivenessElement.TIMEOUT_STATUS_CODE, 'Se ha agotado el tiempo de sesión');
    }

    private endSession(code: number = BiometricsLivenessElement.SUCCESS_STATUS_CODE, message: string = '') {
        if (this.sessionRunning) {
            this.sessionRunning = false;
            this.caption = message;
            this.showCamera = false;
            if (this.previewPicture && this.showMask) {
                this.faceMaskMode = code === 0 ? MaskMode.SUCCESS : MaskMode.FAILURE;
            } else {
                this.showMask = false;
            }
            this.stopAnomalyDetection();
            this.stopFaceDetection();
            if (code === 0) {
                this.playSuccessAnimation(() => {
                    this.triggerEvent(BiometricsLivenessElement.SESSION_SUCCESS_EVENT);
                    this.showRetryButton = true;
                });
            } else {
                this.playFailureAnimation(() => {
                    this.triggerEvent(BiometricsLivenessElement.SESSION_FAIL_EVENT, { code, message });
                    this.showRetryButton = true;
                });
            }
        }
    }

    private async startSession() {
        if (!this.sessionRunning) {
            this.sessionRunning = true;
            this.picture = null;
            this.zoomedPicture = null;
            this.showStartButton = false;
            this.showRetryButton = false;
            this.previewPicture = null;
            this.removeAnimation();
            this.showCamera = true;
            this.showMask = true;
            this.faceZoomMode = false;
            this.faceMaskMode = MaskMode.NORMAL;
            if (this.anomalyDetectionEnabled) {
                this.startAnomalyDetection();
            }
            this.startFaceDetection();
        }
    }
}

BiometricsLivenessElement.register();
