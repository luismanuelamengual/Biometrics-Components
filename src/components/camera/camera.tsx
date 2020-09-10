import {Component, Event, EventEmitter, h, Host, Prop} from '@stencil/core';

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

    @Event()
    pictureCaptured: EventEmitter;

    videoElement!: HTMLVideoElement;
    canvasElement!: HTMLCanvasElement;

    constructor() {
        this.capture = this.capture.bind(this);
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
        context.drawImage(video, sx, sy, canvasWidth, canvasHeight, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
        this.pictureCaptured.emit(canvas.toDataURL('image/jpeg'));
    }

    render() {
        return <Host>
            <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement}/>
            <div class="camera">
                <div class="camera-video-wrapper">
                    <div class="camera-video">
                        <video ref={(el) => this.videoElement = el as HTMLVideoElement} autoplay playsinline/>
                        <slot/>
                    </div>
                </div>
                <div class="camera-controls">
                    <button type="button" class="snapshotButton" onClick={this.capture}/>
                </div>
            </div>
        </Host>;
    }
}
