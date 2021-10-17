import {BiometricsElement} from "../../element";
import styles from "./index.scss";
import {BiometricsCameraElement} from "../camera";
import {Detector, FrontalFaceClassifier} from "cascade-classifier-detector";

export class BiometricsLivenessElement extends BiometricsElement {

    private static readonly DEFAULT_DETECTION_INTERVAL = 100;

    private detector: Detector;
    private cameraElement: BiometricsCameraElement;
    private maskElement: HTMLElement;
    private captionElement: HTMLParagraphElement;
    private faceDetectionTask: any;
    private faceDetectionRunning = false;
    private faceMatching = false;
    private caption = '';

    /**
     * @internal
     */
    constructor() {
        super(true);
        this.detector = new Detector();
        this.detector.loadClassifier('frontal_face', FrontalFaceClassifier);
    }

    protected onConnected() {
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

    protected createContent(): Array<HTMLElement> {
        return [
            this.createCamera(),
            this.createMask()
        ];
    }

    private createCamera(): BiometricsCameraElement {
        this.cameraElement = this.createElement('biometrics-camera', {
            attributes: {
                controls: 'false',
                fullscreen: 'false',
                'aspect-ratio': '1',
                'facing-mode': 'user'
            }
        });
        return this.cameraElement;
    }

    private createMask(): HTMLElement {
        this.maskElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as HTMLElement;
        this.maskElement.classList.add('mask');
        this.maskElement.setAttribute('viewBox', '0 0 1000 1000');
        this.maskElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.maskElement.innerHTML = `
            <defs><mask id="faceMask"><rect width="1000" height="1000" fill="white"></rect><ellipse fill="black" stroke="none" cx="500" cy="500" rx="200" ry="300"></ellipse></mask></defs>
            <rect class="mask-background" width="1000" height="1000" mask="url(#faceMask)"></rect>
            <ellipse class="mask-siluette" cx="500" cy="500" rx="200" ry="300"></ellipse>
        `;
        return this.maskElement;
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
            const detectedItems = this.detector.detect('frontal_face', imageData);
            if (detectedItems && detectedItems.length > 0) {
                const detectedItem = detectedItems[0];
                const centerX = ((elementWidth / 2) - (cameraSize / 2)) + detectedItem.center.x * imageXFactor;
                const centerY = ((elementHeight / 2) - (cameraSize / 2)) + detectedItem.center.y * imageYFactor;
                const radius = detectedItem.radius * imageXFactor;
                const diameter = radius * 2;
                faceRect = new DOMRect(centerX - radius,centerY - radius, diameter, diameter);
            }
        }
        return faceRect;
    }

    public get detectionInterval(): number {
        return this.hasAttribute('detection-interval')? parseInt(this.getAttribute('detection-interval')) : BiometricsLivenessElement.DEFAULT_DETECTION_INTERVAL;
    }

    public set detectionInterval(detectionInterval: number) {
        this.setAttribute('detection-interval', String(detectionInterval));
    }

    private async executeFaceDetection() {
        let faceMatching = true;
        let caption = null;
        const faceRect = await this.detectFace();
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
            if (distanceToCenterInPercentage > 3.5) {
                faceMatching = false;
                caption = 'Rostro no centrado';
            }
        }
        this.setFaceMatching(faceMatching);
        this.setCaption(caption);
    }

    public stopFaceDetection() {
        if (this.faceDetectionRunning) {
            this.faceDetectionRunning = false;
            if (this.faceDetectionTask) {
                clearTimeout(this.faceDetectionTask);
                this.faceDetectionTask = null;
            }
        }
    }

    public startFaceDetection() {
        if (!this.faceDetectionRunning) {
            this.faceDetectionRunning = true;
            const faceExecutionTask = async () => {
                await this.executeFaceDetection();
                if (this.faceDetectionRunning) {
                    if (this.faceDetectionTask) {
                        clearTimeout(this.faceDetectionTask);
                        this.faceDetectionTask = null;
                    }
                    this.faceDetectionTask = setTimeout(async () => faceExecutionTask(), this.detectionInterval);
                }
            }
            faceExecutionTask();
        }
    }

    private setFaceMatching(faceMatching: boolean) {
        if (this.faceMatching != faceMatching) {
            this.faceMatching = faceMatching;
            if (this.faceMatching) {
                this.maskElement.classList.add('mask-match');
            } else {
                this.maskElement.classList.remove('mask-match');
            }
        }
    }

    private setCaption(caption: string) {
        if (caption != this.caption) {
            this.caption = caption;
            if (this.caption) {
                if (!this.captionElement) {
                    this.captionElement = this.createElement('p', {classes: 'caption'}, caption);
                    this.getContainer().append(this.createElement('div', {classes: 'caption-container'}, [this.captionElement]));
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
}

BiometricsLivenessElement.register();
