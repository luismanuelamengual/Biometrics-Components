import {Component, Element, getAssetPath, h, Host, Prop, State} from '@stencil/core';
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

    readonly FACE_ASPECT_RATIO = 0.75;

    @Element() host: HTMLElement;

    @Prop() serverUrl: string;

    @Prop() apiKey: string;

    @Prop() startOnInit = true;

    @Prop() maxPictureWidth = 1280;

    @Prop() maxPictureHeight = 1280;

    @Prop() faceDetectionInterval = 200;

    @Prop() sessionStartSeconds = 3;

    @Prop() maskAnimationSeconds = 3;

    @Prop() maskAnimationExponent = 2;

    @Prop() maxTrailPictures = 8;

    @Prop() maxTrailPictureWidth = 320;

    @Prop() maxTrailPictureHeight = 320;

    @Prop() showStartButton = true;

    @State() picture: Blob;

    @State() caption: string;

    @State() captionStyle: 'normal' | 'danger' = 'normal';

    @State() activeAnimation!: 'loading' | 'success' | 'fail';

    @State() maskVisible = false;

    @State() startButtonVisible = true;

    @State() remainingSessionStartSeconds: number | null = null;

    detector: Detector = new Detector();
    cameraElement: HTMLBiometricsCameraElement;
    sessionRunning: boolean;
    maskElement!: HTMLDivElement;
    faceDetectionTask: any = null;
    faceMatchTask: any = null;
    trailPictures: Array<Blob> = [];
    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;

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
            this.stopSession();
        });
        this.successAnimation = Lottie.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: successAnimationData,
            container: this.successAnimationElement
        });
        this.successAnimation.addEventListener('complete', () => {
            this.stopSession();
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
        this.setCaption('');
        this.setMaskVisible(true);
        this.setStartButtonVisible(false);
        this.clearAnimation();
        this.adjustMask();
        this.startFaceDetection(this.faceDetectionInterval);
    }

    stopSession() {
        this.setMaskVisible(false);
        this.setStartButtonVisible(true);
        this.sessionRunning = false;
    }

    startFaceDetection(interval: number) {
        this.stopFaceDetection();
        this.faceDetectionTask = setInterval(async () => {
            const faceRect = await this.detectFaceRect();
            let caption = '';
            let faceMatch = false;
            if (faceRect != null) {
                const maskWidth = this.maskElement.offsetWidth;
                const maskHeight = this.maskElement.offsetHeight;
                const maskCenterX = this.maskElement.offsetLeft + (maskWidth/2);
                const maskCenterY = this.maskElement.offsetTop + (maskHeight/2);
                if (faceRect.width < maskWidth || faceRect.height < maskWidth) {
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
            this.setCaption(caption);
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
            this.remainingSessionStartSeconds = null;
            this.faceMatchTask = null;
        }
    }

    startFaceMatchTimer() {
        if (!this.faceMatchTask) {
            this.remainingSessionStartSeconds = this.sessionStartSeconds;
            this.faceMatchTask = setInterval( async () => {
                this.remainingSessionStartSeconds--;
                if (this.remainingSessionStartSeconds <= 0) {
                    this.picture = await this.cameraElement.getSnapshot(this.maxPictureWidth, this.maxPictureHeight, 'image/jpeg', 0.95);
                    this.stopFaceMatchTimer();
                    this.stopFaceDetection();
                    this.setCaption('Centre su rostro en el marco');
                    this.animateMask();
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

    adjustMask() {
        if (this.maskElement) {
            const hostWidth = this.host.offsetWidth;
            const hostHeight = this.host.offsetHeight;
            const hostSizePercentage = hostWidth > hostHeight ? 0.85 : 0.6;
            const hostSize = Math.min(hostWidth / this.FACE_ASPECT_RATIO, hostHeight);
            const maskHeight = hostSize * hostSizePercentage;
            const maskWidth = hostSize * hostSizePercentage * this.FACE_ASPECT_RATIO;
            const maskLeft = (hostWidth / 2) - (maskWidth / 2);
            const maskTop = (hostHeight / 2) - (maskHeight / 2);
            this.maskElement.style.left = maskLeft + 'px';
            this.maskElement.style.top = maskTop + 'px';
            this.maskElement.style.width = maskWidth + 'px';
            this.maskElement.style.height = maskHeight + 'px';
        }
    }

    animateMask() {
        if (this.maskElement) {
            this.trailPictures = [];
            const exponent = this.maskAnimationExponent;
            const left = this.maskElement.offsetLeft;
            const top = this.maskElement.offsetTop;
            const width = this.maskElement.offsetWidth;
            const height = this.maskElement.offsetHeight;
            const newWidth = width * exponent;
            const newHeight = height * exponent;
            const newLeft = (left + (width/2)) - (newWidth/2);
            const newTop = (top + (height/2)) - (newHeight/2);
            const maskAnimation = this.maskElement.animate([
                {
                    left: left + 'px',
                    top: top + 'px',
                    width: width + 'px',
                    height: height + 'px'
                },
                {
                    left: newLeft + 'px',
                    top: newTop + 'px',
                    width: newWidth + 'px',
                    height: newHeight + 'px'
                }
            ], {
                duration: this.maskAnimationSeconds * 1000,
            });
            const snapshotTask = setInterval(async () => {
                await this.takeTrailPicture();
            }, (this.maskAnimationSeconds * 1000) / this.maxTrailPictures);
            maskAnimation.onfinish = async () => {
                clearInterval(snapshotTask);
                this.maskElement.style.left = newLeft + 'px';
                this.maskElement.style.top = newTop + 'px';
                this.maskElement.style.width = newWidth + 'px';
                this.maskElement.style.height = newHeight + 'px';
                await this.takeTrailPicture();
                this.setMaskVisible(false);
                this.setCaption('');
                this.verifyLiveness();
            };
            maskAnimation.play();
        }
    }

    async takeTrailPicture() {
        const trailPicture = await this.cameraElement.getSnapshot(this.maxTrailPictureWidth, this.maxTrailPictureHeight, 'image/jpeg', 0.95);
        if (this.trailPictures.length < this.maxTrailPictures) {
            this.trailPictures.push(trailPicture);
        }
    }

    async verifyLiveness() {
        this.runAnimation('loading');
        try {
            let response: any;
            try {
                const formData = new FormData();
                formData.append('trailPicturesCount', this.trailPictures.length.toString());
                for (let i = 0; i < this.trailPictures.length; i++) {
                    formData.append('trailPicture' + (i+1), this.trailPictures[i]);
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
            this.runAnimation('success');
        } catch (e) {
            this.setCaption(e.message);
            this.runAnimation('fail');
        }
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

            <div ref={(el) => this.maskElement = el as HTMLDivElement} class={{
                'mask': true,
                'hidden': !this.maskVisible
            }}/>

            {this.remainingSessionStartSeconds > 0 && <div class="liveness-seconds">{ this.remainingSessionStartSeconds }</div>}

            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}}>{this.caption}</p>
            </div>}
            {this.showStartButton && this.startButtonVisible && <div class="liveness-buttons-wrapper">
                <button class="liveness-start-button" onClick={this.onStartButtonClick} >Iniciar</button>
            </div>}
        </Host>;
    }
}
