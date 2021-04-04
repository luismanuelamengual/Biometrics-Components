import {Component, Element, Event, EventEmitter, getAssetPath, h, Host, Prop, State} from '@stencil/core';
import {Detector} from "../../utils/detector";
import Lottie from "lottie-web";
// @ts-ignore
import loadingAnimationData from './assets/animations/loading.json';
// @ts-ignore
import failAnimationData from './assets/animations/fail.json';
// @ts-ignore
import successAnimationData from './assets/animations/success.json';

@Component({
    tag: 'biometrics-liveness3d',
    styleUrl: 'liveness3d.scss',
    assetsDirs: ['assets'],
    shadow: true
})
export class Liveness3d {

    @Element() host: HTMLElement;

    @Prop() serverUrl: string;

    @Prop() apiKey: string;

    @Prop() startOnInit = true;

    @Prop() maxPictureWidth = 1280;

    @Prop() maxPictureHeight = 1280;

    @Prop() faceDetectionInterval = 200;

    @Prop() faceDetectionSeconds = 2;

    @Prop() showStartButton = true;

    @Prop() debugMode = false;

    @State() picture: Blob = null;

    @State() zoomedPicture: Blob = null;

    @State() caption: string;

    @State() captionStyle: 'normal' | 'danger' = 'normal';

    @State() activeAnimation!: 'loading' | 'success' | 'fail';

    @State() maskVisible = false;

    @State() maskMatch = false;

    @State() startButtonVisible = true;

    @State() remainingFaceDetectionSeconds: number | null = null;

    @Event() sessionSucceded: EventEmitter;

    @Event() sessionFailed: EventEmitter;

    detector: Detector = new Detector();
    cameraElement: HTMLBiometricsCameraElement;
    sessionRunning: boolean;
    maskElement!: HTMLDivElement;
    faceDetectionTask: any = null;
    faceMatchTask: any = null;
    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;
    livenessDebugData = null;

    constructor() {
        this.onStartButtonClick = this.onStartButtonClick.bind(this);
    }

    componentWillLoad() {
        if (this.startOnInit) {
            this.caption = '';
            this.maskVisible = true;
            this.startButtonVisible = false;
            this.activeAnimation = null;
        }
    }

    componentDidLoad() {
        this.initializeAnimations();
        this.initializeDetector();
        if (this.startOnInit) {
            this.startSession();
        }
    }

    onStartButtonClick() {
        this.startSession();
    }

    initializeAnimations() {
        this.loadingAnimation = Lottie.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: true,
            animationData: loadingAnimationData,
            container: this.loadingAnimationElement
        });
        this.failAnimation = Lottie.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: failAnimationData,
            container: this.failAnimationElement
        });
        this.failAnimation.addEventListener('complete', () => {
            this.onSessionFail();
        });
        this.successAnimation = Lottie.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: successAnimationData,
            container: this.successAnimationElement
        });
        this.successAnimation.addEventListener('complete', () => {
            this.onSessionSuccess();
        });
    }

    async initializeDetector() {
        await this.detector.loadClassifierFromUrl('frontal_face', getAssetPath(`./assets/cascades/frontal-face`));
    }

    setCaption(caption: string, style: 'normal' | 'danger' = 'normal') {
        this.caption = caption;
        this.captionStyle = style;
    }

    startSession() {
        this.sessionRunning = true;
        this.maskMatch = false;
        this.picture = null;
        this.zoomedPicture = null;
        this.livenessDebugData = null;
        this.setCaption('');
        this.setMaskVisible(true);
        this.setStartButtonVisible(false);
        this.clearAnimation();
        this.startFaceDetection(this.faceDetectionInterval);
    }

    stopSession() {
        this.setMaskVisible(false);
        this.setStartButtonVisible(true);
        this.sessionRunning = false;
    }

    onSessionFail() {
        this.stopSession();
        this.sessionFailed.emit({
            debugData: this.livenessDebugData
        });
    }

    onSessionSuccess() {
        this.stopSession();
        this.sessionSucceded.emit({
            picture: this.picture,
            zoomedPicture: this.zoomedPicture,
            debugData: this.livenessDebugData
        });
    }

    startFaceDetection(interval: number) {
        this.stopFaceDetection();
        this.faceDetectionTask = setInterval(async () => {
            const faceRect = await this.detectFaceRect();
            let caption = null;
            let faceMatch = false;
            if (faceRect != null) {
                const maskRect = this.maskElement.getBoundingClientRect();
                const maskWidth = maskRect.width;
                const maskHeight = maskRect.height;
                const maskCenterX = maskRect.x + (maskWidth/2);
                const maskCenterY = maskRect.y + (maskHeight/2);
                if (faceRect.width < (maskWidth*0.8) || faceRect.height < (maskWidth*0.8)) {
                    caption = 'Acerque su rostro a la camara';
                } else if (faceRect.width > (maskWidth * 1.2) || faceRect.height > (maskWidth * 1.2)) {
                    caption = 'Aleje su rostro de la camara';
                } else {
                    const faceCenterX = faceRect.x + (faceRect.width / 2);
                    const faceCenterY = faceRect.y + (faceRect.height / 2);
                    const faceMaxOffsetDifferential = maskWidth * 0.1;
                    const faceXDifferential = Math.abs(faceCenterX - maskCenterX);
                    const faceYDifferential = Math.abs(faceCenterY - maskCenterY);
                    if (faceXDifferential > faceMaxOffsetDifferential || faceYDifferential > faceMaxOffsetDifferential) {
                        caption = 'El rostro no esta centrado';
                    } else {
                        faceMatch = true;
                    }
                }
            } else {
                caption = 'El rostro no ha sido encontrado';
            }
            if (caption) {
                this.setCaption(caption);
            }
            this.maskMatch = faceMatch;
            if (faceMatch) {
                this.startFaceMatchTimer();
            } else {
                this.stopFaceMatchTimer();
            }
        }, interval);
    }

    stopFaceDetection() {
        if (this.faceDetectionTask) {
            clearInterval(this.faceDetectionTask);
            this.faceDetectionTask = null;
        }
    }

    stopFaceMatchTimer() {
        if (this.faceMatchTask) {
            clearInterval(this.faceMatchTask);
            this.remainingFaceDetectionSeconds = null;
            this.faceMatchTask = null;
        }
    }

    startFaceMatchTimer() {
        if (!this.faceMatchTask) {
            this.setCaption('Mantenga su rostro firme durante un momento ...');
            this.remainingFaceDetectionSeconds = this.faceDetectionSeconds;
            this.faceMatchTask = setInterval( async () => {
                this.remainingFaceDetectionSeconds--;
                if (this.remainingFaceDetectionSeconds <= 0) {
                    const picture = await this.cameraElement.getSnapshot(this.maxPictureWidth, this.maxPictureHeight, 'image/jpeg', 0.95);
                    if (!this.picture) {
                        this.picture = picture;
                    } else {
                        this.zoomedPicture = picture;
                        this.setMaskVisible(false);
                        this.stopFaceDetection();
                        this.verifyLiveness();
                    }
                    this.stopFaceMatchTimer();
                }
            }, 1000);
        }
    }

    setMaskVisible(maskVisible: boolean) {
        this.maskVisible = maskVisible;
    }

    setStartButtonVisible(startButtonVisible: boolean) {
        this.startButtonVisible = startButtonVisible;
    }

    async detectFaceRect(): Promise<DOMRect> {
        let faceRect: DOMRect = null;
        const imageData = await this.cameraElement.getSnapshotImageData (320, 320);
        if (imageData != null) {
            const imageWidth = imageData.width;
            const imageHeight = imageData.height;
            const cameraWidth = this.cameraElement.offsetWidth;
            const cameraHeight = this.cameraElement.offsetHeight;
            const imageXFactor = cameraWidth / imageWidth;
            const imageYFactor = cameraHeight / imageHeight;
            let detections = this.detector.detect('frontal_face', imageData);
            if (detections && detections.length) {
                detections = detections.filter((detection) => detection[3] > 5).sort((detection1, detection2) => detection1[3] - detection2[3]);
                const bestDetection = detections[0];
                if (bestDetection && bestDetection.length >= 3) {
                    const centerY = bestDetection[0] * imageXFactor;
                    const centerX = bestDetection[1] * imageYFactor;
                    const diameter = bestDetection[2] * imageXFactor;
                    const radius = diameter / 2;
                    faceRect = new DOMRect(centerX - radius,centerY - radius, diameter, diameter);
                }
            }
        }
        return faceRect;
    }

    async verifyLiveness() {
        this.setCaption('Verificando identidad');
        this.runAnimation('loading');
        try {
            let response: any;
            try {
                const formData = new FormData();
                formData.append('picture', this.picture);
                formData.append('zoomedPicture', this.zoomedPicture);
                if (this.debugMode) {
                    formData.append('debugMode', 'true');
                }
                let url = this.serverUrl;
                if (!url.endsWith('/')) {
                    url += '/';
                }
                url += 'v1/check_liveness_3d';
                response = await fetch(url, {
                    method: 'post',
                    body: formData,
                    headers: {
                        'Authorization': 'Bearer ' + this.apiKey
                    }
                });
                response = await response.json();
            } catch (e) {
                throw new Error('Error de comunicación con el servidor');
            }
            if (response.data.debugData) {
                this.livenessDebugData = response.data.debugData;
            }
            if (!response.data.liveness) {
                throw new Error('No se superó la prueba de vida');
            }
            this.successSession();
        } catch (e) {
            this.failSession(e.message);
        }
    }

    successSession() {
        this.setCaption('');
        this.runAnimation('success');
    }

    failSession(caption: string) {
        this.setMaskVisible(false);
        this.stopFaceDetection();
        this.stopFaceMatchTimer();
        this.setCaption(caption);
        this.runAnimation('fail');
    }

    runAnimation(animation: 'loading' | 'success' | 'fail') {
        this.activeAnimation = animation;
        switch (this.activeAnimation) {
            case 'loading':
                this.loadingAnimation.goToAndPlay(0, true);
                break;
            case 'success':
                this.successAnimation.goToAndPlay(0, true);
                break;
            case 'fail':
                this.failAnimation.goToAndPlay(0, true);
                break;
        }
    }

    clearAnimation() {
        this.activeAnimation = null;
    }

    render() {
        return <Host>
            <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'loading'}}/>
            <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'success'}}/>
            <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'fail'}}/>
            <biometrics-camera
                ref={(el) => this.cameraElement = el as HTMLBiometricsCameraElement}
                facingMode="user"
                showCaptureButton={false}
                maxPictureWidth={this.maxPictureWidth}
                maxPictureHeight={this.maxPictureHeight}>
            </biometrics-camera>
            {this.maskVisible && <div ref={(el) => this.maskElement = el as HTMLDivElement} class={{
                'mask': true,
                'mask-zoom': this.picture != null,
                'mask-match': this.maskMatch
            }}/>}
            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}}>{this.caption}</p>
            </div>}
            {this.showStartButton && this.startButtonVisible && <div class="liveness-buttons-wrapper">
                <button class="liveness-start-button" onClick={this.onStartButtonClick} >Iniciar</button>
            </div>}
        </Host>;
    }
}
