import {Component, Event, h, EventEmitter, Method, Prop, State} from '@stencil/core';

@Component({
    tag: 'biometrics-camera',
    styleUrl: 'camera.scss',
    shadow: true
})
export class Camera {

    pictureUrl = null;

    @Prop()
    mode: 'auto' | 'native' | 'canvas' = 'auto';

    @Prop()
    maxPictureWidth = 1280;

    @Prop()
    maxPictureHeight = 720;

    @State()
    opened = false;

    @Event()
    pictureCaptured: EventEmitter;

    videoElement!: HTMLVideoElement;
    canvasElement!: HTMLCanvasElement;
    nativeInputElement!: HTMLInputElement;

    constructor() {
        this.capture = this.capture.bind(this);
        this.onPictureCaptured = this.onPictureCaptured.bind(this);
    }

    componentWillLoad() {
        if (this.mode == 'auto') {
            const nativeInput: any = document.createElement('input');
            if (nativeInput.capture === undefined) {
                this.mode = 'canvas';
            } else {
                this.mode = 'native';
            }
        }
    }

    disconnectedCallback(): void {
        this.close();
    }

    @Method()
    async open() {
        if (this.mode === 'canvas') {
            this.initializeVideo();
            this.opened = true;
        } else if (this.mode === 'native') {
            this.nativeInputElement.click();
        }
    }

    @Method()
    async close() {
        if (this.mode === 'canvas') {
            this.finalizeVideo();
            this.opened = false;
        }
    }

    async initializeVideo() {
        try {
            this.videoElement.srcObject = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: 'environment'}});
        } catch (e) {
            // Mostrar un mensaje de error
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

    onPictureCaptured(event) {
        const target = event.target;
        setTimeout(() => {
            const files = target.files;
            const picture = files[0];
            const img = new Image();
            img.onload = () => {
                const imageWidth = img.width;
                const imageHeight = img.height;
                const scale = Math.min((this.maxPictureWidth / imageWidth), (this.maxPictureHeight / imageHeight));
                const iwScaled = imageWidth * scale;
                const ihScaled = imageHeight * scale;
                this.canvasElement.width = iwScaled;
                this.canvasElement.height = ihScaled;
                const context = this.canvasElement.getContext('2d');
                context.drawImage(img, 0, 0, iwScaled, ihScaled);
                const imageUrl = this.canvasElement.toDataURL('image/jpeg');
                this.setPicture(imageUrl);
            };
            img.src = URL.createObjectURL(picture);
        }, 500);
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
        this.setPicture(canvas.toDataURL('image/jpeg'));
        this.close();
    }

    setPicture(pictureUrl: any) {
        this.pictureUrl = pictureUrl;
        this.pictureCaptured.emit(this.pictureUrl);
    }

    render() {
        return <div class={{ 'camera':true, 'camera-open':this.opened }}>
            <canvas ref={(el) => this.canvasElement = el as HTMLCanvasElement}/>
            {this.mode == 'canvas' && this.renderCanvasCamera()}
            {this.mode == 'native' && this.renderNativeCamera()}
        </div>;
    }

    renderCanvasCamera() {
        return <div class="camera-canvas">
            <div class="camera-video-wrapper">
                <div class="camera-video">
                    <video ref={(el) => this.videoElement = el as HTMLVideoElement} autoplay playsinline/>
                    <slot />
                </div>
            </div>
            <div class="camera-controls">
                <button type="button" class="snapshotButton" onClick={this.capture}/>
            </div>
        </div>;
    }

    renderNativeCamera() {
        return <input ref={(el) => this.nativeInputElement = el as HTMLInputElement} type="file" onChange={this.onPictureCaptured} accept="image/!*" capture="camera"/>;
    }
}
