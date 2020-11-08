import {Component, h, Prop, Element, State, Method, Event, EventEmitter, Host, Listen} from '@stencil/core';
import bodymovin from 'bodymovin';
// @ts-ignore
import loadingAnimationData from './assets/animations/loading.json';
// @ts-ignore
import failAnimationData from './assets/animations/fail.json';
// @ts-ignore
import successAnimationData from './assets/animations/success.json';

@Component({
  tag: 'biometrics-liveness',
  styleUrl: 'liveness.scss',
  shadow: true
})
export class Liveness {

    readonly FRONTAL_FACE_INSTRUCTION = 'frontal_face';
    readonly LEFT_PROFILE_FACE_INSTRUCTION = 'left_profile_face';
    readonly RIGHT_PROFILE_FACE_INSTRUCTION = 'right_profile_face';

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

    @Prop() maxInstructions = 5;

    @Prop() instructions = [ this.FRONTAL_FACE_INSTRUCTION, this.LEFT_PROFILE_FACE_INSTRUCTION, this.RIGHT_PROFILE_FACE_INSTRUCTION ];

    @Prop() timeout = 10;

    @Prop() maxPictureWidth = 720;

    @Prop() maxPictureHeight = 600;

    @Prop() showInitButton = true;

    @Prop() messages: any = {};

    @Prop() cameraFacingMode: 'environment' | 'user' | 'left' | 'right' = 'user';

    @State() running = false;

    @State() verifying = false;

    @State() status: number;

    @State() caption: string;

    @State() captionStyle: 'normal' | 'danger' = 'normal';

    @State() activeAnimation!: 'loading' | 'success' | 'fail';

    @Event() sessionStarted: EventEmitter;

    @Event() sessionEnded: EventEmitter;

    @Event() sessionSucceded: EventEmitter;

    @Event() sessionFailed: EventEmitter;

    cameraElement: HTMLBiometricsCameraElement;
    pictures = [];
    instruction = null;
    instructionsRemaining: number;
    instructionTimeoutTask: any;
    marqueeElement!: HTMLDivElement;
    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;
    imageCheckTask = null;
    checkingImage = false;
    marqueeAlert = false;

    constructor() {
        this.handleSessionStartButtonClick = this.handleSessionStartButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeMessages();
        this.initializeAnimations();
        this.adjustMarquee();
        if (this.autoStart) {
            this.startSession();
        }
    }

    componentDidUnload() {
        this.stopSession();
    }

    @Listen('resize', { target: 'window' })
    handleResize() {
        this.adjustMarquee();
    }

    initializeMessages() {
        this.messages.timeout = this.messages.timeout || 'Se ha expirado el tiempo de sesión. Por favor intente nuevamente';
        this.messages.communication_error = this.messages.communication_error || 'Error de comunicación con el servidor';
        this.messages.camera_permission_denied_error = this.messages.camera_permission_denied_error || 'No se ha proporcionado el permiso para el acceso a la cámara web';
        this.messages.face_not_found = this.messages.face_not_found || 'Rostro no encontrado';
        this.messages.face_not_centered = this.messages.face_not_centered || 'Rostro no centrado';
        this.messages.face_too_close = this.messages.face_too_close || 'Rostro demasiado <b>CERCA</b>';
        this.messages.face_too_far = this.messages.face_too_far || 'Rostro demasiado <b>LEJOS</b>. Acerque el rostro';
        this.messages.start_button = this.messages.start_button || 'INICIAR';
        if (!this.messages.face_instructions) {
            this.messages.face_instructions =  {} as any;
            this.messages.face_instructions[this.FRONTAL_FACE_INSTRUCTION] = 'Dirija su rostro hacia el <b>CENTRO</b>';
            this.messages.face_instructions[this.LEFT_PROFILE_FACE_INSTRUCTION] = 'Gire su rostro hacia la <b>DERECHA</b>';
            this.messages.face_instructions[this.RIGHT_PROFILE_FACE_INSTRUCTION] = 'Gire su rostro hacia la <b>IZQUIERDA</b>';
        }
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
            this.verifying = false;
            this.onSessionFail();
        });
        this.successAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: successAnimationData,
            container: this.successAnimationElement
        });
        this.successAnimation.addEventListener('complete', () => {
            this.verifying = false;
            this.onSessionSuccess();
        });
    }

    startImageCheck() {
        if (this.imageCheckTask == null) {
            this.imageCheckTask = setInterval(async () => {
                await this.checkImage();
            }, 200);
        }
    }

    stopImageCheck() {
        if (this.imageCheckTask != null) {
            clearInterval(this.imageCheckTask);
            this.imageCheckTask = null;
        }
    }

    @Method()
    async startSession() {
        this.setCaption('');
        this.status = 0;
        this.pictures = [];
        this.instructionsRemaining = this.maxInstructions;
        this.running = true;
        this.verifying = false;
        this.clearAnimation();
        this.startSessionInstruction(this.FRONTAL_FACE_INSTRUCTION);
        this.startSessionInstructionTimer();
        this.startImageCheck();
        this.sessionStarted.emit();
    }

    @Method()
    async stopSession() {
        this.stopSessionInstructionTimer();
        this.stopImageCheck();
        this.running = false;
        this.sessionEnded.emit();
    }

    async checkImage() {
        if (!this.checkingImage) {
            this.checkingImage = true;
            try {
                const image: Blob = await this.cameraElement.getSnapshot (320, 320);
                if (image !== null) {
                    const formData = new FormData();
                    formData.append('instruction', this.instruction);
                    formData.append('selfie', image);
                    let url = this.serverUrl;
                    if (!url.endsWith('/')) {
                        url += '/';
                    }
                    url += 'v1/check_liveness_instruction';
                    let response: any = await fetch (url, {
                        method: 'post',
                        body: formData,
                        headers: {
                            'Authorization': 'Bearer ' + this.apiKey
                        }
                    });
                    response = await response.json();
                    if (response.success) {
                        this.status = response.data.status;
                        this.updateMessage();
                        this.updateMarqeeStyle();
                        if (this.status < this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                            this.instructionsRemaining = this.maxInstructions;
                            this.pictures = [];
                            if (this.instruction !== this.FRONTAL_FACE_INSTRUCTION) {
                                this.startSessionInstruction(this.FRONTAL_FACE_INSTRUCTION);
                            }
                        } else if (this.status === this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                            this.status = this.FACE_WITH_INCORRECT_GESTURE_STATUS_CODE;
                            this.pictures.push(await this.cameraElement.getSnapshot(this.maxPictureWidth, this.maxPictureHeight));
                            this.instructionsRemaining--;
                            if (!this.instructionsRemaining) {
                                this.stopSession();
                                await this.onSessionComplete();
                            } else {
                                this.startSessionInstruction(this.getNextSessionInstruction(this.instruction));
                                this.startSessionInstructionTimer();
                            }
                        }
                    }
                }
            } catch (e) {
                this.setCaption(this.messages.communication_error, "danger");
                this.stopSession();
            }
            this.checkingImage = false;
        }
    }

    async onSessionComplete() {
        this.verifying = true;
        this.runAnimation("loading");
        try {
            const formData = new FormData();
            formData.append('imagesCount', this.pictures.length.toString());
            for (var i = 0; i < this.pictures.length; i++) {
                formData.append('image' + (i + 1), this.pictures[i]);
            }
            let url = this.serverUrl;
            if (!url.endsWith('/')) {
                url += '/';
            }
            url += 'v1/check_liveness_images';
            let response: any = await fetch(url, {
                method: 'post',
                body: formData,
                headers: {
                    'Authorization': 'Bearer ' + this.apiKey
                }
            });
            response = await response.json();
            if (response.success && response.data.status) {
                this.runAnimation('success');
            } else {
                this.runAnimation('fail');
            }
        } catch (e) {
            this.runAnimation('fail');
        }
    }

    onSessionSuccess() {
        this.stopSession();
        this.sessionSucceded.emit({
            pictures: this.pictures
        });
    }

    onSessionFail() {
        this.stopSession();
    }

    getNextSessionInstruction(instruction) {
        const instructions = this.instructions;
        const possibleInstructions = instructions.filter(item => item !== instruction);
        const minInstructionIndex = 0;
        const maxInstructionIndex = possibleInstructions.length - 1;
        const nextInstructionIndex = Math.floor(Math.random() * (maxInstructionIndex - minInstructionIndex + 1)) + minInstructionIndex;
        return possibleInstructions[nextInstructionIndex];
    }

    stopSessionInstructionTimer() {
        if (this.instructionTimeoutTask) {
            clearTimeout(this.instructionTimeoutTask);
            this.instructionTimeoutTask = null;
        }
    }

    startSessionInstructionTimer() {
        this.stopSessionInstructionTimer();
        this.instructionTimeoutTask = setTimeout(() => {
            this.setCaption(this.messages.timeout, 'danger');
            this.stopSession();
        }, this.timeout * 1000);
    }

    startSessionInstruction(instruction) {
        this.instruction = instruction;
        this.updateMessage();
    }

    handleSessionStartButtonClick () {
        this.startSession();
    }

    updateMessage() {
        if (this.running) {
            switch (this.status) {
                case this.FACE_MATCH_SUCCESS_STATUS_CODE:
                    this.setCaption('');
                    break;
                case this.FACE_NOT_FOUND_STATUS_CODE:
                    this.setCaption(this.messages.face_not_found, 'danger');
                    break;
                case this.FACE_NOT_CENTERED_STATUS_CODE:
                    this.setCaption(this.messages.face_not_centered, 'danger');
                    break;
                case this.FACE_TOO_CLOSE_STATUS_CODE:
                    this.setCaption(this.messages.face_too_close, 'danger');
                    break;
                case this.FACE_TOO_FAR_AWAY_STATUS_CODE:
                    this.setCaption(this.messages.face_too_far, 'danger');
                    break;
                case this.FACE_WITH_INCORRECT_GESTURE_STATUS_CODE:
                default:
                    this.setCaption(this.messages.face_instructions[this.instruction]);
                    break;
            }
        }
    }

    updateMarqeeStyle() {
        if (this.running) {
            switch (this.status) {
                case this.FACE_MATCH_SUCCESS_STATUS_CODE:
                case this.FACE_WITH_INCORRECT_GESTURE_STATUS_CODE:
                    this.marqueeAlert = false;
                    break;
                default:
                    this.marqueeAlert = true;
                    break;
            }
        }
    }

    clearAnimation() {
        this.activeAnimation = null;
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

    adjustMarquee() {
        const hostRect = this.host.getBoundingClientRect();
        const hostHeight = hostRect.height;
        const hostWidth = hostRect.width;
        const marqueeAspectRatio = 3.2 / 4;
        const hostAspectRatio = hostWidth / hostHeight;
        let marqueeLeft;
        let marqueeTop;
        let marqueeWidth;
        let marqueeHeight;
        const hostPadding = 120;
        if (hostAspectRatio > marqueeAspectRatio) {
            marqueeHeight = Math.min(hostHeight - 30, Math.max(300, hostHeight - (hostPadding * 2)));
            marqueeWidth = marqueeHeight * marqueeAspectRatio;
            marqueeTop = (hostHeight - marqueeHeight) / 2;
            marqueeLeft = (hostWidth / 2) - (marqueeWidth / 2);
        } else {
            marqueeWidth = Math.min(hostWidth - 30, Math.max(200, hostWidth - (hostPadding * 2)));
            marqueeHeight = marqueeWidth * (1 / marqueeAspectRatio);
            marqueeLeft = (hostWidth - marqueeWidth) / 2;
            marqueeTop = (hostHeight / 2) - (marqueeHeight / 2);
        }
        this.marqueeElement.style.left = marqueeLeft + 'px';
        this.marqueeElement.style.top = marqueeTop + 'px';
        this.marqueeElement.style.width = marqueeWidth + 'px';
        this.marqueeElement.style.height = marqueeHeight + 'px';
    }

    render() {
        return <Host>
            <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'loading'}}/>
            <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'success'}}/>
            <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'fail'}}/>

            <biometrics-camera ref={(el) => this.cameraElement = el as HTMLBiometricsCameraElement} facingMode={this.cameraFacingMode} showCaptureButton={false} maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight}>
                <div ref={(el) => this.marqueeElement = el as HTMLDivElement} class={{"marquee": true, "marquee-danger": this.marqueeAlert, "hidden": !this.running}}/>
            </biometrics-camera>

            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}} innerHTML={this.caption}/>
            </div>}
            {this.showInitButton && !this.verifying && !this.running && <div class="liveness-buttons-wrapper">
                <button class="liveness-start-button" onClick={this.handleSessionStartButtonClick} >{this.messages.start_button}</button>
            </div>}
        </Host>;
    }
}
