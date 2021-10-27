import {BiometricsElement} from "../../element";
import styles from "./index.scss";
import {BiometricsCameraElement} from "../camera";
import {Detector, FrontalFaceClassifier} from "cascade-classifier-detector";
import {BiometricsAnimationElement} from "../animation";
import loadingAnimationData from './animations/loading-animation-data';
import successAnimationData from './animations/success-animation-data';
import failureAnimationData from './animations/failure-animation-data';
import {MaskMode} from "./mask-mode";
import {CodeError, BiometricsApi} from "biometrics-core";

export class BiometricsLivenessElement extends BiometricsElement {

    public static readonly SESSION_STARTED_EVENT = 'sessionStarted';
    public static readonly SESSION_ENDED_EVENT = 'sessionEnded';
    public static readonly SESSION_SUCCESS_EVENT = 'sessionSuccess';
    public static readonly SESSION_FAIL_EVENT = 'sessionFail';
    public static readonly SESSION_TIMEOUT_EVENT = 'sessionTimeout';

    private static readonly MIN_FACE_DISTANCE_TO_CENTER_PERCENTAGE = 6;
    private static readonly MIN_FACE_SCALE_PERCENTAGE = 40;
    private static readonly MAX_FACE_SCALE_PERCENTAGE = 55;
    private static readonly MIN_ZOOMED_FACE_SCALE_PERCENTAGE = 60;
    private static readonly MAX_ZOOMED_FACE_SCALE_PERCENTAGE = 75;
    private static readonly DEFAULT_DETECTION_INTERVAL = 100;
    private static readonly DEFAULT_CAPTURE_DELAY_SECONDS = 2;
    private static readonly DEFAULT_TIMEOUT_SECONDS = 30;
    private static readonly FACE_ASPECT_RATIO = 0.73333;

    private _api: BiometricsApi;
    private _detector: Detector;
    private _showRetryButton = false;
    private _showCamera = false;
    private _showMask = false;
    private _showFaceIndicator = false;
    private _faceRect: DOMRect = null;
    private _cameraElement: BiometricsCameraElement;
    private _maskElement: HTMLElement;
    private _faceIndicatorElement: HTMLDivElement;
    private _faceDetectionRunning = false;
    private _faceDetectionTask: any;
    private _faceMaskMode: MaskMode = MaskMode.NORMAL;

    private animationElement: BiometricsAnimationElement;
    private captionElement: HTMLParagraphElement;
    private timerElement: HTMLDivElement;
    private pictureElement: HTMLImageElement;
    private sessionTimeoutTask: any;
    private sessionRunning = false;
    private faceCaptureTask: any;
    private faceZoomMode = false;
    private caption = '';
    private picture: Blob = null;
    private zoomedPicture: Blob = null;

    /**
     * @internal
     */
    constructor() {
        super(true);
        this._api = new BiometricsApi();
        this._detector = new Detector(FrontalFaceClassifier, {memoryBufferEnabled: true});
    }

    protected onConnected() {
        if (this.hasAttribute('server-url')) {
            this.serverUrl = this.getAttribute('server-url');
        }
        if (this.hasAttribute('api-key')) {
            this.apiKey = this.getAttribute('api-key');
        }

        // BORRAR EL INICIO AUTOMATICO
        this.startSession();
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

    private get showRetryButton(): boolean {
        return this._showRetryButton;
    }

    private set showRetryButton(showRetryButton: boolean) {
        if (showRetryButton != this._showRetryButton) {
            this._showRetryButton = showRetryButton;
            if (this._showRetryButton) {
                this.appendElement(this.createElement('button', {
                    classes: ['button', 'retry-button'],
                    listeners: {
                        click: () => this.startSession()
                    }
                }, 'Reintentar'));
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
                        'video-width': 2048,
                        'video-height': 2048
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
                if (detectedItems && detectedItems.length > 0) {
                    if (detectedItems.length > 1) {
                        detectedItems = detectedItems.sort((detection1, detection2) => detection2.radius - detection1.radius);
                    }
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
            this.setCaption(caption);
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
                    this._faceDetectionTask = setTimeout(async () => this._faceDetectionRunning && faceExecutionTask(), this.detectionInterval);
                }
            }
            await faceExecutionTask();
        }
    }

    private setFaceZoomMode(faceZoomMode: boolean) {
        if (this.faceZoomMode != faceZoomMode) {
            this.faceZoomMode = faceZoomMode;
            if (this._maskElement) {
                if (this.faceZoomMode) {
                    this._maskElement.classList.add('mask-zoom');
                } else {
                    this._maskElement.classList.remove('mask-zoom');
                }
            }
        }
    }

    private setCaption(caption: string) {
        if (caption != this.caption) {
            this.caption = caption;
            if (this.caption) {
                if (!this.captionElement) {
                    this.captionElement = this.createElement('p', {classes: 'caption'}, caption);
                    this.appendElement(this.createElement('div', {classes: 'caption-container'}, [this.captionElement]));
                } else {
                    this.captionElement.innerHTML = caption;
                }
            } else {
                if (this.captionElement) {
                    this.findElement('.caption-container').remove();
                    this.captionElement = null;
                }
            }
        }
    }

    private removePreviewPicture() {
        if (this.pictureElement) {
            this.pictureElement.remove();
            this.pictureElement = null;
        }
    }

    private async showPreviewPicture(picture: Blob) {
        const pictureUrl: string = await (new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(picture);
            reader.onloadend = () => resolve(reader.result as string);
        }));
        if (this.pictureElement) {
            this.pictureElement.setAttribute('src', pictureUrl);
        } else {
            this.pictureElement = this.createElement('img', {classes: 'preview-picture', attributes: {src: pictureUrl}});
            this.appendElement(this.pictureElement);
        }
    }

    private removeAnimation() {
        if (this.animationElement) {
            this.animationElement.remove();
            this.animationElement = null;
        }
    }

    private playAnimation(animationData: object, loop = true, onComplete: () => void | null = null) {
        if (!this.animationElement) {
            this.animationElement = this.createElement('biometrics-animation', {classes: 'animation'});
            this.appendElement(this.animationElement);
        } else {
            this.animationElement.stop();
        }
        setTimeout(() => {
            this.animationElement.src = animationData;
            this.animationElement.loop = loop;
            this.animationElement.onComplete = onComplete;
            this.animationElement.play();
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
        if (this.faceCaptureTask) {
            clearInterval(this.faceCaptureTask);
            this.faceCaptureTask = null;
        }
        if (this.timerElement) {
            this.timerElement.remove();
            this.timerElement = null;
        }
    }

    private startFaceCaptureTimer() {
        if (!this.faceCaptureTask) {
            let remainingSeconds = this.captureDelaySeconds;
            this.timerElement = this.createElement('div', {classes: 'timer'}, '');
            this.appendElement(this.timerElement);
            this.timerElement.innerText = remainingSeconds.toString();
            this.faceCaptureTask = setInterval(async () => {
                remainingSeconds--;
                if (remainingSeconds > 0) {
                    this.timerElement.innerText = remainingSeconds.toString();
                } else {
                    this.timerElement.innerText = '';
                    if (remainingSeconds === 0) {
                        await this.onPictureCaptured(await this._cameraElement.getSnapshotBlob());
                    } if (remainingSeconds < 0) {
                        this.stopFaceCaptureTimer();
                    }
                }
            }, 1000);
        }
    }

    private clearSessionTimer() {
        if (this.sessionTimeoutTask) {
            clearTimeout(this.sessionTimeoutTask);
            this.sessionTimeoutTask = null;
        }
    }

    private startSessionTimer() {
        this.clearSessionTimer();
        if (this.timeoutSeconds > 0) {
            this.sessionTimeoutTask = setTimeout(() => this.onSessionTimeout(), this.timeoutSeconds * 1000);
        }
    }

    private async onPictureCaptured(picture: Blob) {
        if (!this.picture) {
            this.picture = picture;
            this.setFaceZoomMode(true);
        } else if (!this.zoomedPicture) {
            this.zoomedPicture = picture;
            this.clearSessionTimer();
            this.stopFaceDetection();
            this.stopFaceCaptureTimer();
            this.showFaceIndicator = false;
            await this.showPreviewPicture(this.zoomedPicture);
            this.showCamera = false;
            await this.verifyLiveness();
        }
    }

    private async verifyLiveness() {
        this.setCaption('Analizando ...');
        this.faceMaskMode = MaskMode.NORMAL;
        this.playLoadingAnimation();
        try {
            let response;
            try {
                response = await this._api.checkLiveness3d(this.picture, this.zoomedPicture);
            } catch (e) {
                throw new CodeError(-1, 'Error de comunicación con el servidor');
            }
            if (!response || !response.liveness) {
                throw new CodeError(-1, 'No se superó la prueba de vida');
            }
            this.onSessionSuccess();
        } catch (e) {
            this.onSessionFail(e.message);
        }
    }

    private onSessionTimeout() {
        this.stopFaceDetection();
        this.stopFaceCaptureTimer();
        this.showFaceIndicator = false;
        this.showCamera = false;
        this.showMask = false;
        this.triggerEvent(BiometricsLivenessElement.SESSION_TIMEOUT_EVENT);
        this.onSessionFail('Se ha agotado el tiempo de sesión');
    }

    private onSessionSuccess() {
        this.setCaption('Prueba de vida superada exitosamente');
        this.faceMaskMode = MaskMode.SUCCESS;
        this.playSuccessAnimation(() => {
            this.triggerEvent(BiometricsLivenessElement.SESSION_SUCCESS_EVENT);
            this.endSession();
        });
    }

    private onSessionFail(reasonMessage = '') {
        this.setCaption(reasonMessage);
        this.faceMaskMode = MaskMode.FAILURE;
        this.playFailureAnimation(() => {
            this.triggerEvent(BiometricsLivenessElement.SESSION_FAIL_EVENT);
            this.endSession();
        });
    }

    private endSession() {
        if (this.sessionRunning) {
            this.sessionRunning = false;
            this.showRetryButton = true;
            this.triggerEvent(BiometricsLivenessElement.SESSION_ENDED_EVENT);
        }
    }

    public async startSession() {
        if (!this.sessionRunning) {
            this.sessionRunning = true;
            this.picture = null;
            this.zoomedPicture = null;
            this.showRetryButton = false;
            this.removePreviewPicture();
            this.removeAnimation();
            this.showCamera = true;
            this.showMask = true;
            this.setFaceZoomMode(false);
            this.faceMaskMode = MaskMode.NORMAL;
            this.startSessionTimer();
            await this.startFaceDetection();
            this.triggerEvent(BiometricsLivenessElement.SESSION_STARTED_EVENT);
        }
    }
}

BiometricsLivenessElement.register();
