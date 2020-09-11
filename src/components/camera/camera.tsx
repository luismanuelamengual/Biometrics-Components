import {Component, Event, EventEmitter, h, Host, Prop, State} from '@stencil/core';

@Component({
    tag: 'biometrics-camera',
    styleUrl: 'camera.scss',
    shadow: true
})
export class Camera {

    @Prop()
    maxPictureWidth = 1280;

    @Prop()
    maxPictureHeight = 720;

    @Prop()
    facingMode: 'environment' | 'user' | 'left' | 'right' = 'environment';

    @State()
    picture: string = null;

    @Event()
    pictureCaptured: EventEmitter;

    videoElement!: HTMLVideoElement;
    canvasElement!: HTMLCanvasElement;

    constructor() {
        this.onSnapshotButtonClick = this.onSnapshotButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeVideo();
    }

    disconnectedCallback(): void {
        this.finalizeVideo();
    }

    async initializeVideo() {
        try {
            this.videoElement.srcObject = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: this.facingMode}});
        } catch (e) {}
    }

    finalizeVideo() {
        const stream = this.videoElement.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach((track) => {
                track.stop();
            });
        }
    }

    onSnapshotButtonClick() {
        if (!this.picture) {
            this.capture();
            this.finalizeVideo();
        } else {
            this.picture = null;
            this.initializeVideo();
        }
    }

    capture() {
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
        if (scaledCanvasWidth > this.maxPictureWidth || scaledCanvasHeight > this.maxPictureHeight) {
            const scale = Math.min((this.maxPictureWidth / canvasWidth), (this.maxPictureHeight / canvasHeight));
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
        this.setPicture(canvas.toDataURL('image/jpeg'));
    }

    setPicture(picture: string) {
        this.picture = picture;
        this.pictureCaptured.emit(this.picture);
    }

    render() {
        return <Host>
            <div class="camera">
                <div class="camera-video-wrapper">
                    <div class="camera-video">
                        <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement} class={{"video-element": true, "active": this.picture !== null}}/>
                        <video ref={(el) => this.videoElement = el as HTMLVideoElement} class={{"video-element": true, "video-user-mode": this.facingMode === 'user'}} autoplay playsinline/>
                        <slot/>
                    </div>
                </div>
                <div class="camera-controls">
                    <button type="button" class={{"snapshot-button": true, "confirmation-mode": this.picture !== null}} onClick={this.onSnapshotButtonClick}/>
                </div>
            </div>
        </Host>;
    }
}
