import {Component, h, Prop, Element, Listen, State, Method, Event, EventEmitter} from '@stencil/core';
import bodymovin from 'bodymovin';

// @ts-ignore
import loadingAnimationData from './animations/loading.json';

// @ts-ignore
import failAnimationData from './animations/fail.json';

// @ts-ignore
import successAnimationData from './animations/success.json';

@Component({
  tag: 'biometrics-liveness-passive',
  styleUrl: 'liveness_passive.scss',
  shadow: true
})
export class Liveness_passive {

    readonly PHASE_INIT = 0;
    readonly PHASE_READY = 1;
    readonly PHASE_IMAGE_CHECK = 2;
    readonly PHASE_VERIFYING = 3;
    readonly PHASE_VERIFY_SUCCESS = 4;
    readonly PHASE_VERIFY_FAIL = 5;

    readonly FACE_MATCH_SUCCESS_STATUS_CODE = 0;
    readonly FACE_WITH_INCORRECT_GESTURE_STATUS_CODE = 1;
    readonly FACE_NOT_FOUND_STATUS_CODE = -1;
    readonly FACE_NOT_CENTERED_STATUS_CODE = -2;
    readonly FACE_TOO_CLOSE_STATUS_CODE = -3;
    readonly FACE_TOO_FAR_AWAY_STATUS_CODE = -4;

    @Element() host: HTMLElement;

    @Prop() serverUrl: string;

    @Prop() apiKey: string;

    @Prop() autoStart = true;

    @Prop() timeout = 10;

    @Prop() maxPictureWidth = 720;

    @Prop() maxPictureHeight = 600;

    @Prop() showInitButton = true;

    @Prop() messages: any = {};

    @Prop() livenessTimeout = 5;

    @State() phase = this.PHASE_INIT;

    @State() status: number;

    @State() message: string;

    @State() livenessTimeoutSecondsRemaining: number;

    @Event() phaseChanged: EventEmitter;

    @Event() livenessVerificationComplete: EventEmitter;

    videoElement!: HTMLVideoElement;
    videoOverlayElement!: HTMLDivElement;
    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    canvasElement!: HTMLCanvasElement;
    pictureCanvasElement!: HTMLCanvasElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;
    picture = null;
    imageCheckTask: any;
    livenessTask: any;
    livenessTimeoutTask: any;

    constructor() {
        this.handleSessionStartButtonClick = this.handleSessionStartButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeMessages();
        this.initializeAnimations();
        this.initializeVideo();
    }

    componentDidUnload() {
        this.finalizeVideo();
    }

    @Listen('resize', { target: 'window' })
    handleResize() {
        this.adjustVideoOverlay();
    }

    initializeMessages() {
        this.messages.timeout = this.messages.timeout || 'Se ha expirado el tiempo de sesión. Por favor intente nuevamente';
        this.messages.communication_error = this.messages.communication_error || 'Error de comunicación con el servidor';
        this.messages.camera_permission_denied_error = this.messages.camera_permission_denied_error || 'No se ha proporcionado el permiso para el acceso a la cámara web';
        this.messages.face_not_found = this.messages.face_not_found || 'Rostro no encontrado';
        this.messages.face_not_centered = this.messages.face_not_centered || 'Rostro no centrado';
        this.messages.face_too_close = this.messages.face_too_close || 'Rostro demasiado cerca';
        this.messages.face_too_far = this.messages.face_too_far || 'Rostro demasiado lejos. Acerque el rostro';
        this.messages.start_button = this.messages.start_button || 'INICIAR';
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
            this.livenessVerificationComplete.emit({livenessVerified: false});
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
        });
    }

    async initializeVideo() {
        this.videoElement.addEventListener('loadeddata', () => {
            this.adjustVideoOverlay();
            this.setPhase(this.PHASE_READY);
            if (this.autoStart) {
                this.startSession();
            }
        }, false);
        try {
            this.videoElement.srcObject = await navigator.mediaDevices.getUserMedia({video: true});
        } catch (e) {
            this.message = this.messages.camera_permission_denied_error;
        }
    }

    finalizeVideo() {
        const stream = this.videoElement.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
            });
        }
    }

    @Method()
    async startSession() {
        this.setPhase(this.PHASE_IMAGE_CHECK);
    }

    @Method()
    async stopSession() {
        this.setPhase(this.PHASE_READY);
    }

    setPhase(phase: number) {
        if (phase !== this.phase) {
            this.stopLivenessTimer();
            this.stopImageCheckTimer();
            this.stopLivenessTimeoutTimer();
            switch(phase) {
                case this.PHASE_READY:
                    this.resetData();
                    break;
                case this.PHASE_IMAGE_CHECK:
                    this.startImageCheckTimer();
                    break;
                case this.PHASE_VERIFYING:
                    this.loadingAnimation.goToAndPlay(0, true);
                    this.checkLivenessImage();
                    break;
                case this.PHASE_VERIFY_SUCCESS:
                    this.successAnimation.goToAndPlay(0, true);
                    break;
                case this.PHASE_VERIFY_FAIL:
                    this.failAnimation.goToAndPlay(0, true);
                    break;
            }
            this.phase = phase;
            this.phaseChanged.emit({ phase: this.phase });
        }
    }

    resetData() {
        this.loadingAnimation.goToAndStop(0);
        this.failAnimation.goToAndStop(0);
        this.successAnimation.goToAndStop(0);
        this.status = 0;
        this.picture = null;
    }

    stopLivenessTimeoutTimer() {
        if (this.livenessTimeoutTask) {
            clearTimeout(this.livenessTimeoutTask);
            this.livenessTimeoutTask = null;
        }
    }

    startLivenessTimeoutTimer() {
        if (!this.livenessTimeoutTask) {
            this.livenessTimeoutTask = setTimeout(() => {
                this.message = this.messages.timeout;
                this.stopSession();
            }, this.timeout * 1000);
        }
    }

    stopImageCheckTimer() {
        if (this.imageCheckTask) {
            clearInterval(this.imageCheckTask);
            this.imageCheckTask = null;
        }
    }

    startImageCheckTimer() {
        if (!this.imageCheckTask) {
            this.imageCheckTask = setInterval(() => {
                this.checkImage();
            }, 1000);
        }
    }

    stopLivenessTimer() {
        this.livenessTimeoutSecondsRemaining = null;
        if (this.livenessTask) {
            clearInterval(this.livenessTask);
            this.livenessTask = null;
        }
    }

    startLivenessTimer() {
        if (!this.livenessTask) {
            this.livenessTimeoutSecondsRemaining = this.livenessTimeout;
            this.livenessTask = setInterval(() => {
                this.livenessTimeoutSecondsRemaining--;
                if (this.livenessTimeoutSecondsRemaining <= 0) {
                    this.setPhase(this.PHASE_VERIFYING);
                }
            }, 1000);
        }
    }

    checkLivenessImage() {
        this.picture = this.getPicture(this.maxPictureWidth, this.maxPictureHeight);
        let url = this.serverUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'v1/check_liveness_image';
        fetch (url, {
            method: 'post',
            body: this.convertImageToBlob(this.picture),
            headers: {
                'Authorization': 'Bearer ' + this.apiKey
            }
        }).then((response) => response.json()).then((response) => {
            const livenessVerified = response.data.liveness;
            if (livenessVerified) {
                this.setPhase(this.PHASE_VERIFY_SUCCESS);
            } else {
                this.setPhase(this.PHASE_VERIFY_FAIL);
            }
        });
    }

    checkImage() {
        try {
            const imageUrl = this.getCheckPicture();
            let url = this.serverUrl;
            if (!url.endsWith('/')) {
                url += '/';
            }
            url += 'v1/check_liveness_image?verifyLiveness=false';
            fetch (url, {
                method: 'post',
                body: this.convertImageToBlob(imageUrl),
                headers: {
                    'Authorization': 'Bearer ' + this.apiKey
                }
            })
            .then((response) => response.json())
            .then((response) => {
                if (this.phase === this.PHASE_IMAGE_CHECK) {
                    if (response.success) {
                        this.status = response.data.status;
                        this.updateMessage();
                        if (this.status < this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                            this.startLivenessTimeoutTimer();
                            this.stopLivenessTimer();
                        } else {
                            this.stopLivenessTimeoutTimer();
                            this.startLivenessTimer();
                        }
                    }
                }
            })
            .catch(() => {
                this.message = this.messages.communication_error;
                this.stopSession();
            });
        } catch (e) {
            this.message = e.message;
        }
    }

    getCheckPicture() {
        const video = this.videoElement;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspectRatio = videoHeight / videoWidth;
        const canvas = this.canvasElement;
        const context = canvas.getContext('2d');
        if (videoWidth >= 320) {
            canvas.width = 320;
            canvas.height = 320 * videoAspectRatio;
            context.drawImage(video, 0, 0, 320, 320 * videoAspectRatio);
        } else {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
            context.drawImage(video, 0, 0, videoWidth, videoHeight);
        }
        return canvas.toDataURL('image/jpeg', 0.7);
    }

    getPicture(maxWidth: number, maxHeight: number) {
        const livenessPictureCanvas = this.pictureCanvasElement;
        const video = this.videoElement;
        const scale = Math.min((maxWidth / video.videoWidth), (maxHeight / video.videoHeight));
        const canvasWidth = video.videoWidth * scale;
        const canvasHeight = video.videoHeight * scale;
        livenessPictureCanvas.width = canvasWidth;
        livenessPictureCanvas.height = canvasHeight;
        const context = livenessPictureCanvas.getContext('2d');
        context.drawImage(video, 0, 0, canvasWidth, canvasHeight);
        return livenessPictureCanvas.toDataURL('image/jpeg');
    }

    updateMessage() {
        switch (this.status) {
            case this.FACE_MATCH_SUCCESS_STATUS_CODE:
                this.message = null;
                break;
            case this.FACE_NOT_FOUND_STATUS_CODE:
                this.message = this.messages.face_not_found;
                break;
            case this.FACE_NOT_CENTERED_STATUS_CODE:
                this.message = this.messages.face_not_centered;
                break;
            case this.FACE_TOO_CLOSE_STATUS_CODE:
                this.message = this.messages.face_too_close;
                break;
            case this.FACE_TOO_FAR_AWAY_STATUS_CODE:
                this.message = this.messages.face_too_far;
                break;
            default:
                this.message = null;
                break;
        }
    }

    handleSessionStartButtonClick () {
        this.startSession();
    }

    convertImageToBlob(dataURI): Blob {
        let byteString;
        const dataURITokens = dataURI.split(',');
        if (dataURITokens[0].indexOf('base64') >= 0) {
            byteString = atob(dataURITokens[1]);
        } else {
            byteString = this.convertImageToBlob(dataURITokens[1]);
        }
        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: 'image/jpeg'});
    }

    adjustVideoOverlay() {
        const el = this.host;
        const video = this.videoElement;
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const videoOverlay = this.videoOverlayElement;
        const widthDifferential = el.offsetWidth - video.videoWidth;
        const heightDifferential = Math.floor(el.offsetHeight - video.videoHeight) * videoAspectRatio;
        let left = 0;
        let right = 0;
        let top = 0;
        let bottom = 0;
        if (widthDifferential < heightDifferential) {
            const differential = Math.floor((heightDifferential - widthDifferential) / videoAspectRatio / 2);
            left = 0;
            right = 0;
            top = differential;
            bottom = differential;
        } else {
            const differential = Math.floor((widthDifferential - heightDifferential) / 2);
            left = differential;
            right = differential;
            top = 0;
            bottom = 0;
        }
        const overlayWidth = el.offsetWidth - left - right;
        const overlayHeight = el.offsetHeight - top - bottom;
        if (overlayWidth > overlayHeight) {
            const differential = Math.floor((overlayWidth - overlayHeight) / 2);
            left += differential;
            right += differential;
        } else {
            const differential = Math.floor((overlayHeight - overlayWidth) / 2);
            top += differential;
            bottom += differential;
        }
        videoOverlay.style.left = left + 'px';
        videoOverlay.style.right = right + 'px';
        videoOverlay.style.top = top + 'px';
        videoOverlay.style.bottom = bottom + 'px';
    }

    render() {
        return <div class="liveness-panel">
            <video ref={(el) => this.videoElement = el as HTMLVideoElement} class="liveness-video" autoplay playsinline/>
            <div ref={(el) => this.videoOverlayElement = el as HTMLDivElement} class="liveness-video-overlay">
                <div class="liveness-video-overlay-content">
                    <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'liveness-hidden': this.phase !== this.PHASE_VERIFYING}}/>
                    <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'liveness-hidden': this.phase !== this.PHASE_VERIFY_SUCCESS}}/>
                    <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'liveness-hidden': this.phase !== this.PHASE_VERIFY_FAIL}}/>

                    {this.phase === this.PHASE_IMAGE_CHECK && <div class={{ 'marquee': true, 'liveness-hidden': this.status >= 0 }}>
                        <div class='marquee-corner marquee-corner-nw'/>
                        <div class='marquee-corner marquee-corner-ne'/>
                        <div class='marquee-corner marquee-corner-sw'/>
                        <div class='marquee-corner marquee-corner-se'/>
                    </div>}
                    {this.livenessTimeoutSecondsRemaining && <div class="liveness-seconds">{ this.livenessTimeoutSecondsRemaining }</div>}
                </div>
            </div>
            <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement}/>
            <canvas ref={(el) => this.pictureCanvasElement = el as HTMLCanvasElement}/>
            {this.message != null && <div class="liveness-instructions-container">
                <p class="liveness-instructions">{ this.message }</p>
            </div>}
            {this.showInitButton && (this.phase === this.PHASE_READY || this.phase === this.PHASE_VERIFY_SUCCESS || this.phase === this.PHASE_VERIFY_FAIL) && <div class="liveness-buttons-wrapper">
                <button class="liveness-start-button" onClick={this.handleSessionStartButtonClick} >{this.messages.start_button}</button>
            </div>}
        </div>;
    }
}
