import {BiometricsElement} from "../../element";
import styles from "./index.scss";

export class BiometricsCameraElement extends BiometricsElement {

    public static readonly CAPTURE_EVENT = 'capture';
    public static readonly CAMERA_STARTED_EVENT = 'cameraStarted';
    public static readonly CAMERA_ENDED_EVENT = 'cameraEnded';
    public static readonly CAMERA_DISCONNECTED_EVENT = 'cameraDisconnected';
    public static readonly CAMERA_NOT_FOUND_EVENT = 'cameraNotFound';
    public static readonly CAMERA_INITIALIZATION_FAILED_EVENT = 'cameraInitializationFailed';

    private static readonly MAX_PICTURE_WIDTH = 4096;
    private static readonly MAX_PICTURE_HEIGHT = 4096;

    private _canvasElement: HTMLCanvasElement;
    private _videoElement: HTMLVideoElement;
    private _controlsElement: HTMLDivElement;

    /**
     * @internal
     */
    constructor() {
        super(true);
        this.onCaptureButtonClick = this.onCaptureButtonClick.bind(this);
    }

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-camera';
    }

    protected async onConnected() {
        if (this.showDeviceSelector) {
            const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
            if (!devices.length) {
                this.triggerEvent(BiometricsCameraElement.CAMERA_NOT_FOUND_EVENT);
            } else {
                const deviceSelector = this.createDeviceSelector(devices);
                this.getContainer().appendChild(deviceSelector);
                this.deviceId = deviceSelector.value;
            }
        }
        await this.startVideoStreaming();
    }

    protected onDisconnected() {
        this.stopVideoStreaming();
    }

    protected createStyles(): string {
        return styles;
    }

    protected createContent(): string | HTMLElement | Array<HTMLElement> {
        return this.createCameraElement();
    }

    private createCameraElement(): HTMLDivElement {
        return this.createElement('div', {classes: {'camera': true, 'camera-fullscreen': this.fullscreen}}, [this.createCameraVideoElement(), this.createCameraControlsElement()]);
    }

    private createCameraVideoElement(): HTMLDivElement {
        this._canvasElement = this.createElement('canvas');
        this._videoElement = this.createElement('video', {attributes: {autoplay: 'true', playsinline: 'true'}, classes: {'video-user-mode': this.facingMode === 'user'}});
        return this.createElement('div', {classes: 'camera-video-area'}, [this._canvasElement, this._videoElement, this.createElement('slot')]);
    }

    private createCameraControlsElement(): HTMLDivElement {
        const button = this.createElement('button', {attributes: {type: 'button', id:"camera-btn"}, classes: ['button', 'button-capture'], listeners: {click: this.onCaptureButtonClick}});
        this._controlsElement = this.createElement('div', {classes: {'camera-controls': true, 'camera-controls-visible': this.controls}}, [button]);
        return this._controlsElement;
    }

    public get fullscreen(): boolean {
        return !this.hasAttribute('fullscreen') || this.getAttribute('fullscreen') === 'true';
    }

    public get facingMode(): 'environment' | 'user' | 'left' | 'right' {
        return (this.getAttribute('facing-mode') as 'environment' | 'user' | 'left' | 'right') || null;
    }

    public set facingMode(facingMode:  'environment' | 'user' | 'left' | 'right') {
        this.setAttribute('facing-mode', facingMode);
    }

    public get aspectRatio(): number {
        return this.hasAttribute('aspect-ratio')? parseInt(this.getAttribute('aspect-ratio')) : 0;
    }

    public set aspectRatio(aspectRatio: number) {
        this.setAttribute('aspect-ratio', String(aspectRatio));
    }

    public get videoHeight(): number {
        return this.hasAttribute('video-height')? parseInt(this.getAttribute('video-height')) : 0;
    }

    public set videoHeight(videoHeight: number) {
        this.setAttribute('video-height', String(videoHeight));
    }

    public get videoWidth(): number {
        return this.hasAttribute('video-width')? parseInt(this.getAttribute('video-width')) : 0;
    }

    public set videoWidth(videoWidth: number) {
        this.setAttribute('video-width', String(videoWidth));
    }

    public get deviceId(): string {
        return this.hasAttribute('device-id')? this.getAttribute('device-id') : '';
    }

    public set deviceId(deviceId: string) {
        this.setAttribute('device-id', deviceId);
    }

    public get showDeviceSelector(): boolean {
        return this.getAttribute('show-device-selector') === 'true';
    }

    public get maxPictureWidth(): number {
        return this.hasAttribute('max-picture-width') ? parseInt(this.getAttribute('max-picture-width')) : BiometricsCameraElement.MAX_PICTURE_WIDTH;
    }

    public set maxPictureWidth(value: number) {
        this.setAttribute('max-picture-width', String(value));
    }

    public get maxPictureHeight(): number {
        return this.hasAttribute('max-picture-height') ? parseInt(this.getAttribute('max-picture-height')) : BiometricsCameraElement.MAX_PICTURE_HEIGHT;
    }

    public set maxPictureHeight(value: number) {
        this.setAttribute('max-picture-height', String(value));
    }

    public get captureType(): 'blob' | 'url' | 'imageData' {
        return this.hasAttribute('capture-type') ? this.getAttribute('capture-type') as 'blob' | 'url' | 'imageData' : 'url';
    }

    public set captureType(value: 'blob' | 'url' | 'imageData') {
        this.setAttribute('capture-type', value);
    }

    public get controls(): boolean {
        return !this.hasAttribute('controls') || this.getAttribute('controls') == 'true';
    }

    public get videoElement(): HTMLVideoElement {
        return this._videoElement;
    }

    public set controls(controls: boolean) {
        this.setAttribute('controls', String(controls));
        if (controls) {
            this._controlsElement.classList.add('camera-controls-visible');
        } else {
            this._controlsElement.classList.remove('camera-controls-visible');
        }
    }

    private createDeviceSelector(devices: Array<MediaDeviceInfo>): HTMLSelectElement {
        const optionElements = devices.map((device: MediaDeviceInfo, index: number) => this.createElement('option', {attributes: { value: device.deviceId}}, device.label || 'camera ' + index));
        return this.createElement('select', {classes: 'camera-selector', listeners: { change: async (e) => {
            this.deviceId = e.target.value;
            await this.startVideoStreaming();
        }}}, optionElements);
    }

    private async startVideoStreaming() {
        this.stopVideoStreaming();
        const mediaFallbackConstraints: Array<MediaStreamConstraints> = [];
        const desiredConstraints: any = {video: {}};
        if (this.deviceId) {
            desiredConstraints.video.deviceId = {exact: this.deviceId};
        }
        if (this.videoWidth) {
            desiredConstraints.video.width = this.videoWidth;
        }
        if (this.videoHeight) {
            desiredConstraints.video.height = this.videoHeight;
        }
        if (this.facingMode) {
            desiredConstraints.video.facingMode = this.facingMode;
        }
        if (this.aspectRatio) {
            desiredConstraints.video.aspectRatio = {exact: this.aspectRatio};
        }
        mediaFallbackConstraints.push(desiredConstraints);
        if (this.deviceId) {
            mediaFallbackConstraints.push({video: {deviceId: {exact: this.deviceId}}});
        }
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
            const videoTracks = videoSource.getVideoTracks();
            if (videoTracks.length > 0) {
                const videoTrack = videoTracks[0];
                videoTrack.onended = () => {
                    this.triggerEvent(BiometricsCameraElement.CAMERA_DISCONNECTED_EVENT);
                    this.stopVideoStreaming();
                }
            }
            this._videoElement.onloadedmetadata = () => this.triggerEvent(BiometricsCameraElement.CAMERA_STARTED_EVENT);
            this._videoElement.srcObject = videoSource;
        } else {
            this.triggerEvent(BiometricsCameraElement.CAMERA_INITIALIZATION_FAILED_EVENT);
        }
    }

    private stopVideoStreaming() {
        if (this._videoElement) {
            const stream = this._videoElement.srcObject as MediaStream;
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
                this._videoElement.srcObject = null;
                this.triggerEvent(BiometricsCameraElement.CAMERA_ENDED_EVENT);
            }
        }
    }

    private onCaptureButtonClick() {
        this.capture();
    }

    async capture() {
        let picture;
        switch(this.captureType) {
            case 'blob':
                picture = await this.getSnapshotBlob(this.maxPictureWidth, this.maxPictureHeight);
                break;
            case 'url':
                picture = await this.getSnapshotUrl(this.maxPictureWidth, this.maxPictureHeight);
                break;
            case 'imageData':
                picture = await this.getSnapshotImageData(this.maxPictureWidth, this.maxPictureHeight);
                break;
        }
        this.triggerEvent(BiometricsCameraElement.CAPTURE_EVENT, picture);
    }

    async getSnapshotBlob(maxWidth: number = 0, maxHeight: number = 0, type: string = 'image/jpeg', quality = 0.95): Promise<Blob> {
        this.takeSnapshot(maxWidth, maxHeight);
        return new Promise<Blob>((resolve) => this._canvasElement.toBlob(resolve, type, quality));
    }

    async getSnapshotUrl(maxWidth: number = 0, maxHeight: number = 0, type: string = 'image/jpeg'): Promise<string> {
        this.takeSnapshot(maxWidth, maxHeight);
        return this._canvasElement.toDataURL(type);
    }

    async getSnapshotImageData(maxWidth: number = 0, maxHeight: number = 0): Promise<ImageData> {
        this.takeSnapshot(maxWidth, maxHeight);
        const canvas = this._canvasElement;
        return canvas.width > 0 && canvas.height ? canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height) : null;
    }

    private takeSnapshot(maxWidth: number = 0, maxHeight: number = 0) {
        const videoElement: HTMLVideoElement = this._videoElement;
        const canvasElement: HTMLCanvasElement = this._canvasElement;
        const videoWidth = videoElement.videoWidth;
        const videoHeight = videoElement.videoHeight;
        let canvasWidth: number = videoWidth;
        let canvasHeight: number = videoHeight;
        let sx: number = 0;
        let sy: number = 0;
        if (this.fullscreen) {
            const videoAspectRatio = videoWidth / videoHeight;
            const componentWidth = videoElement.offsetWidth;
            const componentHeight = videoElement.offsetHeight;
            const componentAspectRatio = componentWidth / componentHeight;
            if (videoAspectRatio > componentAspectRatio) {
                canvasWidth = componentAspectRatio * canvasHeight;
                sx = Math.max(0, (videoWidth / 2) - (canvasWidth / 2));
            } else {
                canvasHeight = canvasWidth / componentAspectRatio;
                sy = Math.max(0, (videoHeight / 2) - (canvasHeight / 2));
            }
        }
        if (maxWidth <= 0) {
            maxWidth = canvasWidth;
        }
        if (maxHeight <= 0) {
            maxHeight = canvasHeight;
        }
        let scaledCanvasWidth: number = canvasWidth;
        let scaledCanvasHeight: number = canvasHeight;
        if (scaledCanvasWidth > maxWidth || scaledCanvasHeight > maxHeight) {
            const scale = Math.min((maxWidth / canvasWidth), (maxHeight / canvasHeight));
            scaledCanvasWidth *= scale;
            scaledCanvasHeight *= scale;
        }
        canvasElement.width = scaledCanvasWidth;
        canvasElement.height = scaledCanvasHeight;
        const context = canvasElement.getContext('2d');
        if (this.facingMode === 'user') {
            context.translate(canvasElement.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(videoElement, sx, sy, canvasWidth, canvasHeight, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
    }
}

BiometricsCameraElement.register();
