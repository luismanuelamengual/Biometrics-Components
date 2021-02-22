import {Component, Element, Event, EventEmitter, h, Host, Method, Prop, State} from '@stencil/core';

@Component({
    tag: 'biometrics-camera',
    styleUrl: 'camera.scss',
    shadow: true
})
export class Camera {

    @Element()
    host: HTMLElement;

    @Prop()
    maxPictureWidth = 1280;

    @Prop()
    maxPictureHeight = 1280;

    @Prop()
    facingMode: 'environment' | 'user' | 'left' | 'right' = 'environment';

    @Prop()
    buttonStyle: 'normal' | 'classic' = 'normal';

    @Prop()
    fullScreen = true;

    @Prop()
    showCaptureButton = true;

    @Prop()
    showConfirmButton = true;

    @State()
    picture: Blob = null;

    @Event()
    pictureCaptured: EventEmitter;

    videoElement!: HTMLVideoElement;
    canvasElement!: HTMLCanvasElement;

    constructor() {
        this.onCaptureButtonClick = this.onCaptureButtonClick.bind(this);
        this.onConfirmButtonClick = this.onConfirmButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeVideo();
    }

    disconnectedCallback(): void {
        this.finalizeVideo();
    }

    async initializeVideo() {
        const hostAspectRatio = this.host.offsetWidth / this.host.offsetHeight;
        const mediaFallbackConstraints: Array<MediaStreamConstraints> = [];
        const videoResolutions = [4096, 2028, 1024, 960, 720];
        if (hostAspectRatio > 1) {
            for (const videoResolution of videoResolutions) {
                mediaFallbackConstraints.push({audio: false, video: {facingMode: this.facingMode, width: { ideal: videoResolution }}});
            }
        } else {
            for (const videoResolution of videoResolutions) {
                mediaFallbackConstraints.push({audio: false, video: {facingMode: this.facingMode, height: { ideal: videoResolution }}});
            }
        }
        mediaFallbackConstraints.push({audio: false, video: {facingMode: this.facingMode}});
        let videoSource = null;
        for (const mediaConstraints of mediaFallbackConstraints) {
            try {
                videoSource = await navigator.mediaDevices.getUserMedia(mediaConstraints);
                if (videoSource != null) {
                    break;
                }
            } catch (e) {}
        }
        if (videoSource != null) {
            this.videoElement.srcObject = videoSource;
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

    onCaptureButtonClick() {
        this.capture();
        this.finalizeVideo();
    }

    onConfirmButtonClick() {
        this.picture = null;
        this.initializeVideo();
    }

    @Method()
    async capture() {
        this.setPicture(await this.getSnapshot(this.maxPictureWidth, this.maxPictureHeight, 'image/jpeg', 0.95));
    }

    @Method()
    async getSnapshot(maxWidth: number, maxHeight: number, type: string = 'image/jpeg', quality = 0.75) {
        this.takeSnapshot(maxWidth, maxHeight);
        return new Promise<Blob>((resolve) => {
            this.canvasElement.toBlob(resolve, type, quality)
        });
    }

    @Method()
    async getSnapshotUrl(maxWidth: number, maxHeight: number, type: string = 'image/jpeg') {
        this.takeSnapshot(maxWidth, maxHeight);
        return this.canvasElement.toDataURL(type);
    }

    @Method()
    async getSnapshotImageData(maxWidth: number, maxHeight: number) {
        this.takeSnapshot(maxWidth, maxHeight);
        const canvas = this.canvasElement;
        return canvas.width > 0 && canvas.height ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height) : null;
    }

    takeSnapshot(maxWidth: number, maxHeight: number) {
        const video = this.videoElement;
        const canvas = this.canvasElement;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspectRatio = videoWidth / videoHeight;
        const componentWidth = video.offsetWidth;
        const componentHeight = video.offsetHeight;
        const componentAspectRatio = componentWidth / componentHeight;
        let canvasWidth: number;
        let canvasHeight: number;
        if (videoAspectRatio > componentAspectRatio) {
            canvasHeight = videoHeight;
            canvasWidth = componentAspectRatio * canvasHeight;
        } else {
            canvasWidth = videoWidth;
            canvasHeight = canvasWidth / componentAspectRatio;
        }
        let scaledCanvasWidth: number = canvasWidth;
        let scaledCanvasHeight: number = canvasHeight;
        if (scaledCanvasWidth > maxWidth || scaledCanvasHeight > maxHeight) {
            const scale = Math.min((maxWidth / canvasWidth), (maxHeight / canvasHeight));
            scaledCanvasWidth *= scale;
            scaledCanvasHeight *= scale;
        }
        canvas.width = scaledCanvasWidth;
        canvas.height = scaledCanvasHeight;
        const context = canvas.getContext('2d');
        let sx: number;
        let sy: number;
        if (videoAspectRatio > componentAspectRatio) {
            sx = Math.max(0, (videoWidth / 2) - (canvasWidth / 2));
            sy = 0;
        } else {
            sx = 0;
            sy = Math.max(0, (videoHeight / 2) - (canvasHeight / 2));
        }
        if (this.facingMode === 'user') {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, sx, sy, canvasWidth, canvasHeight, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
    }

    setPicture(picture: Blob) {
        this.picture = picture;
        this.pictureCaptured.emit(this.picture);
    }

    render() {
        return <Host>
            <div class={{"camera":true, "camera-fullscreen": this.fullScreen}}>
                <div class="camera-video-wrapper">
                    <div class="camera-video">
                        <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement} class={{"video-element": true, "active": this.picture !== null}}/>
                        <video ref={(el) => this.videoElement = el as HTMLVideoElement} class={{"video-element": true, "video-user-mode": this.facingMode === 'user'}} autoplay playsinline/>
                        <slot/>
                    </div>
                </div>
                <div class="camera-controls">
                    {this.picture === null && this.showCaptureButton && <button type="button" class={{"button": true, "button-normal": this.buttonStyle === 'normal', "button-classic": this.buttonStyle === 'classic', "button-capture": true}} onClick={this.onCaptureButtonClick}/>}
                    {this.picture !== null && this.showConfirmButton && <button type="button" class={{"button": true, "button-normal": this.buttonStyle === 'normal', "button-classic": this.buttonStyle === 'classic', "button-confirm": true}} onClick={this.onConfirmButtonClick}/>}
                </div>
            </div>
        </Host>;
    }
}
