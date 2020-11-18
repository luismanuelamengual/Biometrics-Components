import {Component, h, Prop, Element, State, Method, Event, EventEmitter, Host} from '@stencil/core';
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

    @Prop() pictureQuality = 0.95;

    @Prop() maxInstructionPictureWidth = 300;

    @Prop() maxInstructionPictureHeight = 300;

    @Prop() instructionPictureQuality = 0.75;

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
    livenessPicture: Blob;
    instructionPictures: Array<Blob>;
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

    constructor() {
        this.handleSessionStartButtonClick = this.handleSessionStartButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeMessages();
        this.initializeAnimations();
        if (this.autoStart) {
            this.startSession();
        }
    }

    componentDidUnload() {
        this.stopSession();
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
        this.livenessPicture = null;
        this.instructionPictures = [];
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
        this.instruction = null;
        this.running = false;
        this.sessionEnded.emit();
    }

    async checkImage() {
        if (!this.checkingImage) {
            this.checkingImage = true;
            try {
                const image: Blob = await this.cameraElement.getSnapshot (this.maxInstructionPictureWidth, this.maxInstructionPictureHeight, 'image/jpeg', this.instructionPictureQuality);
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
                        if (this.status < this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                            this.instructionsRemaining = this.maxInstructions;
                            this.livenessPicture = null;
                            this.instructionPictures = [];
                            if (this.instruction !== this.FRONTAL_FACE_INSTRUCTION) {
                                this.startSessionInstruction(this.FRONTAL_FACE_INSTRUCTION);
                            }
                        } else if (this.status === this.FACE_MATCH_SUCCESS_STATUS_CODE) {
                            this.status = this.FACE_WITH_INCORRECT_GESTURE_STATUS_CODE;
                            this.instructionPictures.push(image);
                            if (this.livenessPicture === null) {
                                this.livenessPicture = await this.cameraElement.getSnapshot(this.maxPictureWidth, this.maxPictureHeight, 'image/jpeg', this.pictureQuality);
                            }
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
                this.clearAnimation();
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
            formData.append('imagesCount', this.instructionPictures.length.toString());
            for (var i = 0; i < this.instructionPictures.length; i++) {
                formData.append('image' + (i + 1), this.instructionPictures[i]);
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
            if (response.success && response.data.liveness) {
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
            picture: this.livenessPicture,
            instructionPictures: this.instructionPictures
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
            this.clearAnimation();
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

    setCaption(caption: string, style: 'normal' | 'danger' = 'normal') {
        this.caption = caption;
        this.captionStyle = style;
    }

    clearAnimation() {
        this.activeAnimation = null;
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

    render() {
        return <Host>
            <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'loading'}}/>
            <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'success'}}/>
            <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'fail'}}/>

            <biometrics-camera ref={(el) => this.cameraElement = el as HTMLBiometricsCameraElement} facingMode={this.cameraFacingMode} showCaptureButton={false} maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight}>
                <div class={{
                    'instructions-image': true,
                    'instructions-image-frontal-face': this.instruction == this.FRONTAL_FACE_INSTRUCTION,
                    'instructions-image-right-profile-face': this.instruction == this.RIGHT_PROFILE_FACE_INSTRUCTION,
                    'instructions-image-left-profile-face': this.instruction == this.LEFT_PROFILE_FACE_INSTRUCTION
                }}/>
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
