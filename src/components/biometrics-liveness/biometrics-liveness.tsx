import {Component, h, Prop, Element, Listen, State} from '@stencil/core';
import bodymovin from 'bodymovin';

// @ts-ignore
import checkAnimationData from './animations/check.animation.json';
// @ts-ignore
import maskAnimationData from './animations/mask.animation.json';

@Component({
  tag: 'biometrics-liveness',
  styleUrl: 'biometrics-liveness.scss',
  shadow: true
})
export class BiometricsLiveness {

    readonly FRONTAL_FACE_INSTRUCTION = 'frontal_face';
    readonly LEFT_PROFILE_FACE_INSTRUCTION = 'left_profile_face';
    readonly RIGHT_PROFILE_FACE_INSTRUCTION = 'right_profile_face';

    readonly FACE_MATCH_SUCCESS_STATUS_CODE = 0;
    readonly FACE_WITH_INCORRECT_GESTURE_STATUS_CODE = 1;
    readonly FACE_NOT_FOUND_STATUS_CODE = -1;
    readonly FACE_NOT_CENTERED_STATUS_CODE = -2;
    readonly FACE_TOO_CLOSE_STATUS_CODE = -3;
    readonly FACE_TOO_FAR_AWAY_STATUS_CODE = -4;

    readonly MASK_ANIMATION_MAX_FRAMES = 60;

    @Element() host: HTMLElement;

    @Prop() serverUrl: string = 'https://localhost:8080/';

    @Prop() apiKey: string = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJhdXRoMCIsImNsaWVudCI6InRlc3QifQ.5SY_UQaaILYpryU0qNBuPrPTPkF79UhTCNFElXjzUyY';

    @Prop() autoStart = true;

    @Prop() maxInstructions = 5;

    @Prop() timeout = 10;

    @Prop() maxPictureWidth = 720;

    @Prop() maxPictureHeight = 600;

    @State() running: boolean;

    @State() completed: boolean;

    @State() initialized: boolean = false;

    @State() status: number;

    @State() message: string;

    videoElement!: HTMLVideoElement;
    videoOverlayElement!: HTMLDivElement;
    maskAnimationElement!: HTMLDivElement;
    checkAnimationElement!: HTMLDivElement;
    canvasElement!: HTMLCanvasElement;
    pictureCanvasElement!: HTMLCanvasElement;
    checkAnimation = null;
    maskAnimation = null;
    maskAnimationInProgress = false;
    maskAnimationTargetFrame = 0;
    maskAnimationRequestedFrame = 0;
    pictures = [];
    instruction = null;
    instructionsRemaining: number;
    instructionTimeoutTask: any;
    debug = false;

    constructor() {
        this.handleSessionStartButtonClick = this.handleSessionStartButtonClick.bind(this);
    }

    componentDidLoad() {
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

    initializeAnimations() {
        this.checkAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: checkAnimationData,
            container: this.checkAnimationElement
        });
        this.checkAnimation.addEventListener('complete', () => {
            this.onLivenessSessionCompleted();
        });
        this.maskAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: maskAnimationData,
            container: this.maskAnimationElement
        });
        this.maskAnimation.addEventListener('complete', () => {
            if (this.maskAnimationTargetFrame != null && this.maskAnimationTargetFrame !== this.maskAnimationRequestedFrame) {
                this.animateMask(this.maskAnimationRequestedFrame, this.maskAnimationTargetFrame);
                this.maskAnimationRequestedFrame = this.maskAnimationTargetFrame;
            } else {
                this.maskAnimationInProgress = false;
            }
        });
        this.maskAnimation.setSpeed(2);
    }

    async initializeVideo() {
        this.videoElement.addEventListener('loadeddata', () => {
            this.adjustVideoOverlay();
            this.initialized = true;
            if (this.autoStart) {
                this.startLivenessSession();
            }
        }, false);
        this.videoElement.srcObject = await navigator.mediaDevices.getUserMedia({video: true});
    }

    finalizeVideo() {
        const stream = this.videoElement.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
            });
        }
    }

    startLivenessSession() {
        this.checkAnimation.goToAndStop(0);
        this.running = true;
        this.completed = false;
        this.message = null;
        this.status = 0;
        this.pictures = [];
        this.instructionsRemaining = this.maxInstructions;
        this.startLivenessInstruction(this.FRONTAL_FACE_INSTRUCTION);
    }

    stopLivenessSession() {
        this.running = false;
        this.stopLivenessInstructionTimer();
    }

    completeLivenessSession() {
        this.stopLivenessInstructionTimer();
        this.completed = true;
        this.checkAnimation.goToAndPlay(0, true);
    }

    onLivenessSessionCompleted() {
        this.stopLivenessSession();
    }

    getNextInstruction(instruction) {
        const instructions = [
            this.FRONTAL_FACE_INSTRUCTION,
            this.LEFT_PROFILE_FACE_INSTRUCTION,
            this.RIGHT_PROFILE_FACE_INSTRUCTION
        ];
        const possibleInstructions = instructions.filter(item => item !== instruction);
        const minInstructionIndex = 0;
        const maxInstructionIndex = possibleInstructions.length - 1;
        const nextInstructionIndex = Math.floor(Math.random() * (maxInstructionIndex - minInstructionIndex + 1)) + minInstructionIndex;
        return possibleInstructions[nextInstructionIndex];
    }

    stopLivenessInstructionTimer() {
        if (this.instructionTimeoutTask) {
            clearTimeout(this.instructionTimeoutTask);
            this.instructionTimeoutTask = null;
        }
    }

    startLivenessInstructionTimer() {
        this.stopLivenessInstructionTimer();
        this.instructionTimeoutTask = setTimeout(() => {
            if (this.running) {
                this.message = 'Se ha expirado el tiempo de sesión. Por favor intente nuevamente';
                this.stopLivenessSession();
            }
        }, this.timeout * 1000);
    }

    startLivenessInstruction(instruction) {
        if (!this.debug) {
            this.startLivenessInstructionTimer();
        }
        this.setLivenessInstruction(instruction);
        this.checkDiferredImage();
    }

    setLivenessInstruction(livenessInstruction) {
        this.instruction = livenessInstruction;
        switch (livenessInstruction) {
            case this.FRONTAL_FACE_INSTRUCTION:
                this.requestMaskAnimation(this.MASK_ANIMATION_MAX_FRAMES / 2);
                break;
            case this.RIGHT_PROFILE_FACE_INSTRUCTION:
                this.requestMaskAnimation(this.MASK_ANIMATION_MAX_FRAMES);
                break;
            case this.LEFT_PROFILE_FACE_INSTRUCTION:
                this.requestMaskAnimation(0);
                break;
        }
    }

    checkDiferredImage() {
        if (this.running) {
            setTimeout(() => { if (this.running) { this.checkImage(); } }, 50);
        }
    }

    checkImage() {
        try {
            if (this.running) {
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
                const imageUrl = canvas.toDataURL('image/jpeg', 0.7);
                const formData = new FormData();
                formData.append('instruction', this.instruction);
                formData.append('selfie', this.convertImageToBlob(imageUrl));
                fetch (this.serverUrl + 'v1/check_liveness_instruction', {
                    method: 'post',
                    body: formData,
                    headers: {
                        'Authorization': 'Bearer ' + this.apiKey
                    }
                })
                .then((response) => response.json())
                .then((response) => {
                    if (response.success) {
                        if (this.running) {
                            this.status = response.data.status;
                            this.message = this.getStatusMessage(this.status);
                            if (!this.debug && this.status < this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                                this.instructionsRemaining = this.maxInstructions;
                                this.pictures = [];
                                if (this.instruction !== this.FRONTAL_FACE_INSTRUCTION) {
                                    this.startLivenessInstruction(this.FRONTAL_FACE_INSTRUCTION);
                                } else {
                                    this.checkDiferredImage();
                                }
                            } else if (this.status === this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                                if (!this.debug) {
                                    this.pictures.push(this.getPicture(this.maxPictureWidth, this.maxPictureHeight));
                                    this.instructionsRemaining--;
                                    if (!this.instructionsRemaining) {
                                        this.completeLivenessSession();
                                    } else {
                                        this.startLivenessInstruction(this.getNextInstruction(this.instruction));
                                    }
                                } else {
                                    this.startLivenessInstruction(this.getNextInstruction(this.instruction));
                                }
                            } else {
                                this.checkDiferredImage();
                            }
                        }
                    }
                })
                .catch(() => {
                    if (this.running) {
                        this.checkDiferredImage();
                    }
                });
            }
        } catch (e) {
            this.message = e.message;
            this.checkDiferredImage();
        }
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

    getStatusMessage(statusCode) {
        let message = null;
        switch (statusCode) {
            case this.FACE_MATCH_SUCCESS_STATUS_CODE:
                break;
            case this.FACE_NOT_FOUND_STATUS_CODE:
                message = 'Rostro no encontrado';
                break;
            case this.FACE_NOT_CENTERED_STATUS_CODE:
                message = 'Rostro no centrado';
                break;
            case this.FACE_TOO_CLOSE_STATUS_CODE:
                message = 'Rostro demasiado cerca';
                break;
            case this.FACE_TOO_FAR_AWAY_STATUS_CODE:
                message = 'Rostro demasiado lejos. Acerque su rostro';
                break;
            case this.FACE_WITH_INCORRECT_GESTURE_STATUS_CODE:
                message = 'Posiciones su rostro para que coincida con la máscara';
                break;
        }
        return message;
    }

    handleSessionStartButtonClick () {
        this.startLivenessSession();
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

    requestMaskAnimation(frame) {
        if (frame !== this.maskAnimationRequestedFrame) {
            if (!this.maskAnimationInProgress) {
                this.maskAnimationTargetFrame = null;
                this.maskAnimationInProgress = true;
                this.animateMask(this.maskAnimationRequestedFrame, frame);
                this.maskAnimationRequestedFrame = frame;
            } else {
                this.maskAnimationTargetFrame = frame;
            }
        }
    }

    animateMask(fromFrame, toFrame) {
        if (fromFrame !== toFrame) {
            this.maskAnimation.setDirection(toFrame >= fromFrame ? 1 : -1);
            this.maskAnimation.playSegments([fromFrame, toFrame], true);
        }
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
            <div ref={(el) => this.checkAnimationElement = el as HTMLDivElement} class={{ 'liveness-check-animation': true, 'liveness-hidden': !this.running || !this.completed }}></div>
            <video ref={(el) => this.videoElement = el as HTMLVideoElement} class="liveness-video" autoplay playsinline></video>
            <div ref={(el) => this.videoOverlayElement = el as HTMLDivElement} class="liveness-video-overlay">
                <div class="liveness-video-overlay-content">
                    <div ref={(el) => this.maskAnimationElement = el as HTMLDivElement} class={{ 'liveness-mask-animation': true, 'liveness-hidden': !this.running || this.status < 0 || this.completed}}></div>
                    {/*{this.running && <app-liveness-marquee [ngClass]="{'liveness-hidden': livenessMode=='mask' && livenessStatus >= 0}"></app-liveness-marquee>}*/}
                </div>
            </div>
            <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement}></canvas>
            <canvas ref={(el) => this.pictureCanvasElement = el as HTMLCanvasElement}></canvas>
            {this.message != null && <div class="liveness-instructions-container">
                <p class="liveness-instructions">{ this.message }</p>
            </div>}
            {this.initialized && !this.running && <div class="liveness-buttons-wrapper">
                <button class="liveness-start-button" onClick={this.handleSessionStartButtonClick} >INICIAR</button>
            </div>}
        </div>;
    }
}
