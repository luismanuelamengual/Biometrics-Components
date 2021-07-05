// @ts-ignore
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
    pictureQuality = 0.95;

    @Prop()
    facingMode: 'environment' | 'user' | 'left' | 'right' = 'environment';

    @Prop()
    buttonStyle: 'normal' | 'classic' = 'normal';

    @Prop()
    captureType: 'blob' | 'url' | 'imageData' = 'url';

    @Prop()
    fullScreen = true;

    @Prop()
    showCaptureButton = true;

    @Event()
    pictureCaptured: EventEmitter;

    videoElement!: HTMLVideoElement;
    canvasElement!: HTMLCanvasElement;

    constructor() {
        this.onCaptureButtonClick = this.onCaptureButtonClick.bind(this);
    }

    componentDidLoad() {
        this.initializeVideo();
    }

    disconnectedCallback(): void {
        this.finalizeVideo();
    }

    async initializeVideo() {
        const mediaFallbackConstraints: Array<MediaStreamConstraints> = [];
        mediaFallbackConstraints.push({video: {facingMode: this.facingMode}});
        mediaFallbackConstraints.push({video: true});
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
    }

    @Method()
    async capture(options?: {type?: 'blob' | 'url' | 'imageData', maxWidth?: number, maxHeight?: number, quality?: number,  silent?: boolean}) {
        const captureType = options?.type || this.captureType;
        const maxWidth = options?.maxWidth || this.maxPictureWidth;
        const maxHeight = options?.maxHeight || this.maxPictureHeight;
        const quality = options?.quality || this.pictureQuality;
        let picture = null;
        switch(captureType) {
            case 'blob':
                picture = await this.getSnapshotBlob(maxWidth, maxHeight, 'image/jpeg', quality);
                break;
            case 'url':
                picture = await this.getSnapshotUrl(maxWidth, maxHeight);
                break;
            case 'imageData':
                picture = await this.getSnapshotImageData(maxWidth, maxHeight);
                break;
        }
        if (!options?.silent) {
            this.pictureCaptured.emit(picture);
        }
        return picture;
    }

    private async getSnapshotBlob(maxWidth: number, maxHeight: number, type: string = 'image/jpeg', quality = 0.95): Promise<Blob> {
        this.takeSnapshot(maxWidth, maxHeight);
        return new Promise<Blob>((resolve) => {
            this.canvasElement.toBlob(resolve, type, quality)
        });
    }

    private async getSnapshotUrl(maxWidth: number, maxHeight: number, type: string = 'image/jpeg'): Promise<string> {
        this.takeSnapshot(maxWidth, maxHeight);
        return this.canvasElement.toDataURL(type);
    }

    private async getSnapshotImageData(maxWidth: number, maxHeight: number): Promise<ImageData> {
        this.takeSnapshot(maxWidth, maxHeight);
        const canvas = this.canvasElement;
        return canvas.width > 0 && canvas.height ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height) : null;
    }

    private takeSnapshot(maxWidth: number, maxHeight: number) {
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

    render() {
        return <Host>
            <div class={{"camera":true, "camera-fullscreen": this.fullScreen}}>
                <div class="camera-video-wrapper">
                    <div class="camera-video">
                        <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement} class={{"video-element": true}}/>
                        <video ref={(el) => this.videoElement = el as HTMLVideoElement} class={{"video-element": true, "video-user-mode": this.facingMode === 'user'}} autoplay playsinline/>
                        <slot/>
                    </div>
                </div>
                <div class="camera-controls">
                    {this.showCaptureButton && <button type="button" class={{"button": true, "button-normal": this.buttonStyle === 'normal', "button-classic": this.buttonStyle === 'classic', "button-capture": true}} onClick={this.onCaptureButtonClick}/>}
                </div>
            </div>
        </Host>;
    }
}
