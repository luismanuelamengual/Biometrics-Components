import {Component, Event, EventEmitter, getAssetPath, h, Host, Prop, State} from '@stencil/core';
import bodymovin from 'bodymovin';
// @ts-ignore
import loadingAnimationData from './assets/animations/loading.json';
// @ts-ignore
import failAnimationData from './assets/animations/fail.json';
// @ts-ignore
import successAnimationData from './assets/animations/success.json';
import {Detector} from "../../utils/detector";

@Component({
    tag: 'biometrics-liveness-passive',
    styleUrl: 'liveness_passive.scss',
    assetsDirs: ['assets'],
    shadow: true
})
export class Liveness_passive {

    @Prop() serverUrl: string;

    @Prop() apiKey: string;

    @Prop() maxPictureWidth = 720;

    @Prop() maxPictureHeight = 600;

    @Prop() autoCapture = true;

    @Prop() autoCaptureTimeout = 3;

    @Prop() useFaceDetector = true;

    @Prop() faceDetectionInterval = 200;

    @State() cameraOpen = false;

    @State() picture: string;

    @State() caption: string;

    @State() captionStyle: 'normal' | 'danger' = 'normal';

    @State() activeAnimation!: 'loading' | 'success' | 'fail';

    @State() autoCaptureTimeoutSecondsRemaining: number;

    @State() livenessVerificationFinished = false;

    @Event() livenessVerificationComplete: EventEmitter;

    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    marqueeElement!: HTMLDivElement;
    cameraElement: HTMLBiometricsCameraElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;
    detector: Detector = new Detector();
    autoCaptureTask: any = null;
    faceDetectionTask: any = null;

    constructor() {
        this.onPictureCaptured = this.onPictureCaptured.bind(this);
        this.onRestartButtonClick = this.onRestartButtonClick.bind(this);
    }

    componentWillLoad() {
        this.openCamera();
    }

    componentDidLoad() {
        this.initializeAnimations();
    }

    initializeAnimations() {
        this.loadingAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: true,
            animationData: loadingAnimationData,
            container: this.loadingAnimationElement
        });
        this.failAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: failAnimationData,
            container: this.failAnimationElement
        });
        this.failAnimation.addEventListener('complete', () => {
            this.livenessVerificationComplete.emit({livenessVerified: false, picture: this.picture});
            this.livenessVerificationFinished = true;
        });
        this.successAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: successAnimationData,
            container: this.successAnimationElement
        });
        this.successAnimation.addEventListener('complete', () => {
             this.livenessVerificationComplete.emit({livenessVerified: true, picture: this.picture});
             this.livenessVerificationFinished = true;
        });
    }

    async startMarqueeDetection() {
        if (this.useFaceDetector && await this.detector.loadClassifierFromUrl('frontal_face', getAssetPath(`./assets/cascades/frontal-face`))) {
            this.startFaceDetection(this.faceDetectionInterval);
        } else {
            this.marqueeElement.style.opacity = '1';
            this.marqueeElement.style.left = '20%';
            this.marqueeElement.style.top = '20%';
            this.marqueeElement.style.right = '20%';
            this.marqueeElement.style.bottom = '20%';
            this.startAutocaptureTimer();
        }
    }

    stopMarqueeDetection() {
        this.stopFaceDetection();
    }

    async detectFace() {
        const imageData = await this.cameraElement.getSnapshotImageData (320, 320);
        if (imageData != null) {
            const imageWidth = imageData.width;
            const imageHeight = imageData.height;
            const cameraWidth = this.cameraElement.offsetWidth;
            const cameraHeight = this.cameraElement.offsetHeight;
            const imageXFactor = cameraWidth / imageWidth;
            const imageYFactor = cameraHeight / imageHeight;
            let detections = this.detector.detect('frontal_face', imageData);

            let bestDetection = null;
            if (detections && detections.length) {
                detections = detections.filter((detection) => detection[3] > 5).sort((detection1, detection2) => detection1[3] - detection2[3]);
                bestDetection = detections[0];
            }

            if (bestDetection) {
                const centerY = bestDetection[0];
                const centerX = bestDetection[1];
                const diameter = bestDetection[2];
                const marqueeCenterX = centerX * imageXFactor;
                const marqueeCenterY = centerY * imageYFactor;
                const marqueeWidth = diameter * imageXFactor * 0.8;
                const marqueeHeight = diameter * imageYFactor;
                this.marqueeElement.style.opacity = '1';
                this.marqueeElement.style.left = (marqueeCenterX - (marqueeWidth/2)) + 'px';
                this.marqueeElement.style.top = (marqueeCenterY - (marqueeHeight/2)) + 'px';
                this.marqueeElement.style.width = marqueeWidth + 'px';
                this.marqueeElement.style.height = marqueeHeight + 'px';

                const marqueeXDifferential = Math.abs(marqueeCenterX - (cameraWidth/2));
                const marqueeYDifferential = Math.abs(marqueeCenterY - (cameraHeight/2));
                if (marqueeXDifferential > 50 || marqueeYDifferential > 50) {
                    this.setCaption('El rostro no esta centrado. Ubique su rostro en el centro', 'danger');
                    this.marqueeElement.classList.add('marquee-error');
                    this.stopAutocaptureTimer();
                } else {
                    this.setCaption('Ubique su rostro en el centro');
                    this.marqueeElement.classList.remove('marquee-error');
                    this.startAutocaptureTimer();
                }
            } else {
                this.setCaption('El rostro no ha sido encontrado', 'danger');
                this.marqueeElement.style.opacity = '0';
                this.stopAutocaptureTimer();
            }
        }
    }

    stopFaceDetection() {
        if (this.faceDetectionTask) {
            clearInterval(this.faceDetectionTask);
            this.faceDetectionTask = null;
        }
    }

    startFaceDetection(interval: number) {
        this.stopFaceDetection();
        this.faceDetectionTask = setInterval(async () => {
            await this.detectFace();
        }, interval);
    }

    stopAutocaptureTimer() {
        if (this.autoCapture) {
            this.autoCaptureTimeoutSecondsRemaining = null;
            if (this.autoCaptureTask) {
                clearInterval(this.autoCaptureTask);
                this.autoCaptureTask = null;
            }
        }
    }

    startAutocaptureTimer() {
        if (this.autoCapture && !this.autoCaptureTask) {
            this.autoCaptureTimeoutSecondsRemaining = this.autoCaptureTimeout;
            this.autoCaptureTask = setInterval( () => {
                this.autoCaptureTimeoutSecondsRemaining--;
                if (this.autoCaptureTimeoutSecondsRemaining <= 0) {
                    this.cameraElement.capture();
                    this.stopAutocaptureTimer();
                }
            }, 1000);
        }
    }

    openCamera() {
        this.setCaption('');
        this.cameraOpen = true;
        this.livenessVerificationFinished = false;
        this.startMarqueeDetection();
    }

    closeCamera() {
        this.setCaption('');
        this.cameraOpen = false;
        this.stopMarqueeDetection();
    }

    setCaption(caption: string, style: 'normal' | 'danger' = 'normal') {
        this.caption = caption;
        this.captionStyle = style;
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

    async onPictureCaptured(event) {
        this.picture = event.detail;
        this.closeCamera();
        this.runAnimation('loading');
        let url = this.serverUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'v1/check_liveness_image';
        let response: any = null;
        try {
            response = await fetch(url, {
                method: 'post',
                body: await this.convertImageToBlob(this.picture),
                headers: {
                    'Authorization': 'Bearer ' + this.apiKey
                }
            });
            response = await response.json();
        } catch (e) {
            this.setCaption('Error de comunicación', 'danger');
            this.runAnimation('fail');
        }

        if (response) {
            if (response.data.status === 0) {
                this.runAnimation('success');
            } else {
                switch (response.data.status) {
                    case 1000:
                        this.setCaption('No se ha encontrado el rostro en la imagen', 'danger');
                        break;
                    case 1001:
                        this.setCaption('El rostro no esta centrado. Vuelva a intentarlo con el rostro dentro del recuadro', 'danger');
                        break;
                    case 1002:
                        this.setCaption('El rostro se ha encontrado demasiado cerca en la imagen', 'danger');
                        break;
                    case 1003:
                        this.setCaption('El rostro se ha encontrado demasiado lejos en la imagen', 'danger');
                        break;
                    case 2001:
                        this.setCaption('La imagen no ha superado la prueba de brillos. Inténtelo nuevamente en una sala con luminosidad más uniforme', 'danger');
                        break;
                    case 9001:
                        this.setCaption('La imagen no ha superado la prueba de vida. Inténtelo nuevamente con un fondo liso detrás', 'danger');
                        break;
                    default:
                        this.setCaption('La imagen no ha superado la prueba de vida. Código: ' + response.data.status, 'danger');
                        break;
                }
                this.runAnimation('fail');
            }
        }
    }

    onRestartButtonClick() {
        this.openCamera();
    }

    public convertImageToBlob(imageUrl): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                canvas.toBlob(resolve, 'image/jpeg', 0.75);
            };
            image.onerror = () => reject(null);
            image.crossOrigin = 'anonymous';
            image.src = imageUrl;
        });
    }

    render() {
        return <Host>
            <div class={{'liveness-panel': true, 'hidden': this.cameraOpen}}>
                <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'loading'}}/>
                <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'success'}}/>
                <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'fail'}}/>
                <img src={this.picture} />
                {this.livenessVerificationFinished && <div class="liveness-buttons-wrapper">
                    <button class="liveness-start-button" onClick={this.onRestartButtonClick} >Volver a verificar</button>
                </div>}
            </div>
            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}}>{this.caption}</p>
            </div>}
            {this.cameraOpen && this.renderCamera()}
        </Host>;
    }

    renderCamera() {
        return <biometrics-camera ref={(el) => this.cameraElement = el as HTMLBiometricsCameraElement} facingMode="user" showCaptureButton={!this.autoCapture} maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight} onPictureCaptured={this.onPictureCaptured}>
            <div ref={(el) => this.marqueeElement = el as HTMLDivElement} class={{ 'marquee': true }}>
                <div class='marquee-corner marquee-corner-nw'/>
                <div class='marquee-corner marquee-corner-ne'/>
                <div class='marquee-corner marquee-corner-sw'/>
                <div class='marquee-corner marquee-corner-se'/>
            </div>
            {this.autoCaptureTimeoutSecondsRemaining && <div class="liveness-seconds">{ this.autoCaptureTimeoutSecondsRemaining }</div>}
        </biometrics-camera>;
    }
}
