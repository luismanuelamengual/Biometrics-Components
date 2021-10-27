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

    private api: BiometricsApi;
    private detector: Detector;
    private animationElement: BiometricsAnimationElement;
    private cameraElement: BiometricsCameraElement;
    private maskElement: HTMLElement;
    private captionElement: HTMLParagraphElement;
    private timerElement: HTMLDivElement;
    private pictureElement: HTMLImageElement;
    private faceIndicatorElement: HTMLDivElement;
    private startButtonElement: HTMLDivElement;
    private sessionTimeoutTask: any;
    private sessionRunning = false;
    private faceDetectionTask: any;
    private faceCaptureTask: any;
    private faceDetectionRunning = false;
    private faceMaskMode: MaskMode = MaskMode.NORMAL;
    private faceZoomMode = false;
    private caption = '';
    private picture: Blob = null;
    private zoomedPicture: Blob = null;

    /**
     * @internal
     */
    constructor() {
        super(true);
        this.api = new BiometricsApi();
        this.detector = new Detector(FrontalFaceClassifier, {memoryBufferEnabled: true});
    }

    protected onConnected() {
        if (this.hasAttribute('server-url')) {
            this.serverUrl = this.getAttribute('server-url');
        }
        if (this.hasAttribute('api-key')) {
            this.apiKey = this.getAttribute('api-key');
        }
        if (this.autoStartSession) {
            this.startSession();
        } else if (this.showStartButton) {
            this.appendStartButton();
        }
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

    private removeCamera() {
        if (this.cameraElement) {
            this.cameraElement.remove();
            this.cameraElement = null;
        }
    }

    private appendStartButton() {
        if (!this.startButtonElement) {
            this.startButtonElement = this.createElement('button', {
                classes: 'start-button',
                listeners: {
                    click: () => this.startSession()
                }
            }, 'Iniciar');
            this.appendElement(this.startButtonElement);
        }
    }

    private removeStartButton() {
        if (this.startButtonElement) {
            this.startButtonElement.remove();
            this.startButtonElement = null;
        }
    }

    private appendCamera() {
        if (!this.cameraElement) {
            this.cameraElement = this.createElement('biometrics-camera', {
                attributes: {
                    controls: 'false',
                    fullscreen: 'false',
                    'aspect-ratio': '1',
                    'facing-mode': 'user',
                    'video-width': 2048,
                    'video-height': 2048
                }
            });
            this.appendElement(this.cameraElement);
        }
    }

    private removeMask() {
        if (this.maskElement) {
            this.maskElement.remove();
            this.maskElement = null;
        }
    }

    private appendMask() {
        if (!this.maskElement) {
            this.maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement;
            this.maskElement.classList.add('mask');
            if (this.faceMaskMode === MaskMode.SUCCESS) {
                this.maskElement.classList.add('mask-match');
            } else if (this.faceMaskMode === MaskMode.FAILURE) {
                this.maskElement.classList.add('mask-no-match');
            }
            if (this.faceZoomMode) {
                this.maskElement.classList.add('mask-zoom');
            }
            this.maskElement.setAttribute('viewBox', '0 0 1000 1000');
            this.maskElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            const faceWidth = 220;
            const faceHeight = Math.round(faceWidth / BiometricsLivenessElement.FACE_ASPECT_RATIO);
            this.maskElement.innerHTML = `
                <defs><mask id="faceMask"><rect width="1000" height="1000" fill="white"></rect><ellipse fill="black" stroke="none" cx="500" cy="500" rx="${faceWidth}" ry="${faceHeight}"></ellipse></mask></defs>
                <rect class="mask-background" width="1000" height="1000" mask="url(#faceMask)"></rect>
                <ellipse class="mask-siluette" cx="500" cy="500" rx="${faceWidth}" ry="${faceHeight}"></ellipse>
            `;
            this.appendElement(this.maskElement);
        }
    }

    private showFaceIndicator(rect: DOMRect) {
        if (this.faceIndicatorEnabled) {
            if (!this.faceIndicatorElement) {
                this.faceIndicatorElement = this.createElement('div', {classes: 'face-indicator'});
                this.appendElement(this.faceIndicatorElement);
            }
            const newWidth = rect.width * 0.9;
            const newHeight = newWidth / BiometricsLivenessElement.FACE_ASPECT_RATIO;
            const newLeft = rect.left + (rect.width - newWidth) / 2;
            const newTop = rect.top + (rect.height - newHeight) / 2;
            this.faceIndicatorElement.style.left = newLeft + 'px';
            this.faceIndicatorElement.style.top = newTop + 'px';
            this.faceIndicatorElement.style.width = newWidth + 'px';
            this.faceIndicatorElement.style.height = newHeight + 'px';
        }
    }

    private removeFaceIndicator() {
        if (this.faceIndicatorElement) {
            this.faceIndicatorElement.remove();
            this.faceIndicatorElement = null;
        }
    }

    private async detectFace(): Promise<DOMRect> {
        let faceRect: DOMRect = null;
        const imageData = await this.cameraElement.getSnapshotImageData (320, 320);
        if (imageData != null) {
            const imageWidth = imageData.width;
            const imageHeight = imageData.height;
            const elementWidth = this.offsetWidth;
            const elementHeight = this.offsetHeight;
            const cameraSize = Math.min(elementHeight, elementWidth);
            const imageXFactor = cameraSize / imageWidth;
            const imageYFactor = cameraSize / imageHeight;
            let detectedItems = this.detector.detect(imageData);
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
        return faceRect;
    }

    public get serverUrl(): string {
        return this.api.baseUrl;
    }

    public set serverUrl(serverUrl: string) {
        this.api.baseUrl = serverUrl;
    }

    public get apiKey(): string {
        return this.api.apiKey;
    }

    public set apiKey(apiKey: string) {
        this.api.apiKey = apiKey;
    }

    public get faceIndicatorEnabled(): boolean {
        return this.getAttribute('face-indicator-enabled') === 'true';
    }

    public set faceIndicatorEnabled(faceIndicatorEnabled: boolean) {
        this.setAttribute('face-indicator-enabled', String(faceIndicatorEnabled));
    }

    public get showStartButton(): boolean {
        return !this.hasAttribute('show-start-button') || this.getAttribute('show-start-button') === 'true';
    }

    public set showStartButton(showStartButton: boolean) {
        this.setAttribute('show-start-button', String(showStartButton));
        if (showStartButton) {
            if (!this.sessionRunning) {
                this.appendStartButton();
            }
        } else {
            this.removeStartButton();
        }
    }

    public get autoStartSession(): boolean {
        return !this.hasAttribute('auto-start-session') || this.getAttribute('auto-start-session') === 'true';
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

    private async executeFaceDetection() {
        let faceMatching = true;
        let caption = 'Aguarde un momento ...';
        const faceRect = await this.detectFace();
        if (this.faceDetectionRunning) {
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
            this.setFaceMaskMode(faceMatching? MaskMode.SUCCESS : MaskMode.FAILURE);
            this.setCaption(caption);
            if (this.faceIndicatorEnabled) {
                if (!faceMatching && faceRect) {
                    this.showFaceIndicator(faceRect);
                } else {
                    this.removeFaceIndicator();
                }
            }
            if (faceMatching) {
                this.startFaceCaptureTimer();
            } else {
                this.stopFaceCaptureTimer();
            }
        }
    }

    private stopFaceDetection() {
        if (this.faceDetectionRunning) {
            this.faceDetectionRunning = false;
            if (this.faceDetectionTask) {
                clearTimeout(this.faceDetectionTask);
                this.faceDetectionTask = null;
            }
        }
    }

    private async startFaceDetection() {
        if (!this.faceDetectionRunning) {
            this.faceDetectionRunning = true;
            const faceExecutionTask = async () => {
                await this.executeFaceDetection();
                if (this.faceDetectionRunning) {
                    if (this.faceDetectionTask) {
                        clearTimeout(this.faceDetectionTask);
                        this.faceDetectionTask = null;
                    }
                    this.faceDetectionTask = setTimeout(async () => this.faceDetectionRunning && faceExecutionTask(), this.detectionInterval);
                }
            }
            await faceExecutionTask();
        }
    }

    private setFaceMaskMode(faceMaskMode: number) {
        if (this.faceMaskMode != faceMaskMode) {
            this.faceMaskMode = faceMaskMode;
            if (this.maskElement) {
                if (this.faceMaskMode === MaskMode.SUCCESS) {
                    this.maskElement.classList.add('mask-match');
                } else {
                    this.maskElement.classList.remove('mask-match');
                }
                if (this.faceMaskMode === MaskMode.FAILURE) {
                    this.maskElement.classList.add('mask-no-match');
                } else {
                    this.maskElement.classList.remove('mask-no-match');
                }
            }
        }
    }

    private setFaceZoomMode(faceZoomMode: boolean) {
        if (this.faceZoomMode != faceZoomMode) {
            this.faceZoomMode = faceZoomMode;
            if (this.maskElement) {
                if (this.faceZoomMode) {
                    this.maskElement.classList.add('mask-zoom');
                } else {
                    this.maskElement.classList.remove('mask-zoom');
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
                        await this.onPictureCaptured(await this.cameraElement.getSnapshotBlob());
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
            this.removeFaceIndicator();
            await this.showPreviewPicture(this.zoomedPicture);
            this.removeCamera();
            await this.verifyLiveness();
        }
    }

    private async verifyLiveness() {
        this.setCaption('Analizando ...');
        this.setFaceMaskMode(MaskMode.NORMAL);
        this.playLoadingAnimation();
        try {
            let response;
            try {
                response = await this.api.checkLiveness3d(this.picture, this.zoomedPicture);
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
        this.removeFaceIndicator();
        this.removeCamera();
        this.removeMask();
        this.triggerEvent(BiometricsLivenessElement.SESSION_TIMEOUT_EVENT);
        this.onSessionFail('Se ha agotado el tiempo de sesión');
    }

    private onSessionSuccess() {
        this.setCaption('Prueba de vida superada exitosamente');
        this.setFaceMaskMode(MaskMode.SUCCESS);
        this.playSuccessAnimation(() => {
            this.triggerEvent(BiometricsLivenessElement.SESSION_SUCCESS_EVENT);
            this.endSession();
        });
    }

    private onSessionFail(reasonMessage = '') {
        this.setCaption(reasonMessage);
        this.setFaceMaskMode(MaskMode.FAILURE);
        this.playFailureAnimation(() => {
            this.triggerEvent(BiometricsLivenessElement.SESSION_FAIL_EVENT);
            this.endSession();
        });
    }

    private endSession() {
        if (this.sessionRunning) {
            this.sessionRunning = false;
            if (this.showStartButton) {
                this.appendStartButton();
            }
            this.triggerEvent(BiometricsLivenessElement.SESSION_ENDED_EVENT);
        }
    }

    public async startSession() {
        if (!this.sessionRunning) {
            this.sessionRunning = true;
            this.picture = null;
            this.zoomedPicture = null;
            this.removeStartButton();
            this.removePreviewPicture();
            this.removeAnimation();
            this.appendCamera();
            this.appendMask();
            this.setFaceZoomMode(false);
            this.setFaceMaskMode(MaskMode.NORMAL);
            this.startSessionTimer();
            await this.startFaceDetection();
            this.triggerEvent(BiometricsLivenessElement.SESSION_STARTED_EVENT);
        }
    }
}

BiometricsLivenessElement.register();
