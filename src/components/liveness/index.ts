import {BiometricsElement} from "../../element";
import styles from "./index.scss";
import {BiometricsCameraElement} from "../camera";
import {Detector, FrontalFaceClassifier} from "cascade-classifier-detector";

export class BiometricsLivenessElement extends BiometricsElement {

    private static readonly DEFAULT_DETECTION_INTERVAL = 100;

    private detector: Detector;
    private cameraElement: BiometricsCameraElement;
    private maskElement: HTMLElement;
    private faceDetectionTask: any;
    private faceDetectionRunning = false;

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
            const cameraWidth = this.cameraElement.offsetWidth;
            const cameraHeight = this.cameraElement.offsetHeight;
            const cameraSize = Math.min(cameraHeight, cameraWidth);
            const imageXFactor = cameraSize / imageWidth;
            const imageYFactor = cameraSize / imageHeight;
            const detectedItems = this.detector.detect('frontal_face', imageData);
            if (detectedItems && detectedItems.length > 0) {
                const detectedItem = detectedItems[0];
                const centerX = ((cameraWidth / 2) - (cameraSize / 2)) + detectedItem.center.x * imageXFactor;
                const centerY = ((cameraHeight / 2) - (cameraSize / 2)) + detectedItem.center.y * imageYFactor;
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
        const faceRect = await this.detectFace();
        console.log(faceRect);
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
}

BiometricsLivenessElement.register();
