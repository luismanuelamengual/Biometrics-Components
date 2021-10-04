import {BiometricsElement} from "../../element";
import styles from "./index.scss";

export class BiometricsCameraElement extends BiometricsElement {

    public static readonly CAPTURE_EVENT = 'capture';
    public static readonly CAMERA_STARTED_EVENT = 'cameraStarted';
    public static readonly CAMERA_ENDED_EVENT = 'cameraEnded';
    public static readonly CAMERA_DISCONNECTED_EVENT = 'cameraDisconnected';
    public static readonly CAMERA_NOT_FOUND_EVENT = 'cameraNotFound';
    public static readonly CAMERA_INITIALIZATION_FAILED_EVENT = 'cameraInitializationFailed';

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

    protected onConnected() {
        this.initializeVideoStreaming();
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
        return this.createElement('div', {classes: 'camera'}, [this.createCameraVideoElement(), this.createCameraControlsElement()]);
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

    public get facingMode(): 'environment' | 'user' | 'left' | 'right' {
        return (this.getAttribute('facing-mode') as 'environment' | 'user' | 'left' | 'right') || 'environment';
    }

    public set facingMode(facingMode: 'environment' | 'user' | 'left' | 'right') {
        this.setAttribute('facing-mode', facingMode);
        if (facingMode === 'user') {
            this._videoElement.classList.add('user-facing-mode');
        } else {
            this._videoElement.classList.remove('user-facing-mode');
        }
    }

    public get maxPictureWidth(): number {
        return this.hasAttribute('max-picture-width') ? parseInt(this.getAttribute('max-picture-width')) : 2048;
    }

    public set maxPictureWidth(value: number) {
        this.setAttribute('max-picture-width', String(value));
    }

    public get maxPictureHeight(): number {
        return this.hasAttribute('max-picture-height') ? parseInt(this.getAttribute('max-picture-height')) : 2048;
    }

    public set maxPictureHeight(value: number) {
        this.setAttribute('max-picture-height', String(value));
    }

    public get captureType(): 'blob' | 'url' | 'imageData' {
        return this.hasAttribute('capture-type') ? this.getAttribute('capture-type') as 'blob' | 'url' | 'imageData' : 'blob';
    }

    public set captureType(value: 'blob' | 'url' | 'imageData') {
        this.setAttribute('capture-type', value);
    }

    public get controls(): boolean {
        return !this.hasAttribute('controls') || this.getAttribute('controls') == 'true';
    }

    public set controls(controls: boolean) {
        this.setAttribute('controls', String(controls));
        if (controls) {
            this._controlsElement.classList.add('camera-controls-visible');
        } else {
            this._controlsElement.classList.remove('camera-controls-visible');
        }
    }

    private async getVideoStreams(): Promise<Array<MediaDeviceInfo>> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'videoinput');
    }

    private async initializeVideoStreaming() {
        this.removeCameraSelector();
        const devices = await this.getVideoStreams();
        if (!devices.length) {
            this.triggerEvent(BiometricsCameraElement.CAMERA_NOT_FOUND_EVENT);
        } else {
            if (devices.length > 1) {
                this.createCameraSelector(devices);
            }
            this.startVideoStreaming(devices[0].deviceId);
        }
    }

    private removeCameraSelector() {
        const cameraSelectorElement = this.findElement('.camera-selector');
        if (cameraSelectorElement) {
            cameraSelectorElement.remove();
        }
    }

    private createCameraSelector(devices: Array<MediaDeviceInfo>) {
        const optionElements = devices.map((device: MediaDeviceInfo, index: number) => this.createElement('option', {attributes: { value: device.deviceId}}, device.label || 'camera ' + index));
        const selectElement = this.createElement('select', {classes: 'camera-selector', listeners: { change: (e) => this.startVideoStreaming(e.target.value)}}, optionElements);
        this.getContainer().appendChild(selectElement);
    }

    private async startVideoStreaming(deviceId: string) {
        this.stopVideoStreaming();
        const mediaFallbackConstraints: Array<MediaStreamConstraints> = [];
        mediaFallbackConstraints.push({video: {deviceId: {exact: deviceId}, facingMode: this.facingMode}});
        mediaFallbackConstraints.push({video: {deviceId: {exact: deviceId}}});
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
            this._videoElement.srcObject = videoSource;
            this.triggerEvent(BiometricsCameraElement.CAMERA_STARTED_EVENT);
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
        const videoAspectRatio = videoWidth / videoHeight;
        const componentWidth = videoElement.offsetWidth;
        const componentHeight = videoElement.offsetHeight;
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
            context.translate(canvasElement.width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(videoElement, sx, sy, canvasWidth, canvasHeight, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
    }
}

BiometricsCameraElement.register();
