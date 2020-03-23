import {Component, h, Prop, Element} from '@stencil/core';

@Component({
  tag: 'biometrics-liveness',
  styleUrl: 'biometrics-liveness.scss',
  shadow: true
})
export class BiometricsLiveness {

    @Element() host: HTMLElement;

    @Prop() serverUrl: string = 'https://dev-bmc322.globant.com/biometrics/';

    @Prop() autoStart = false;

    videoElement!: HTMLVideoElement;
    videoOverlayElement!: HTMLDivElement;

    componentDidLoad() {
        this.initVideo();
    }

    componentDidUnload() {
        this.finalizeVideo();
    }

    async initVideo() {
        this.videoElement.addEventListener('loadeddata', () => {
            this.adjustVideoOverlay();
            if (this.autoStart) {
                /*this.startLivenessSession();*/
            }
        }, false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            this.videoElement.srcObject = stream;
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

    adjustVideoOverlay() {
        console.log(12);
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
            <video ref={(el) => this.videoElement = el as HTMLVideoElement} autoplay playsinline></video>

            <div ref={(el) => this.videoOverlayElement = el as HTMLDivElement} class="liveness-video-overlay">
                <div class="liveness-video-overlay-content">
                    {/*<div #livenessPointAnimation [ngClass]="{'liveness-point-animation': true, 'liveness-hidden': livenessMode=='mask' || !livenessSessionRunning, 'liveness-point-animation-left': livenessInstruction == 'left_profile_face', 'liveness-point-animation-right': livenessInstruction == 'right_profile_face'}"></div>
                    <div #livenessMaskAnimation [ngClass]="{'liveness-mask-animation': true, 'liveness-hidden': livenessMode=='point' || !livenessSessionRunning || livenessStatus < 0}"></div>
                    <ng-container *ngIf="livenessSessionRunning">
                        <app-liveness-marquee [ngClass]="{'liveness-hidden': livenessMode=='mask' && livenessStatus >= 0}"></app-liveness-marquee>
                    </ng-container>*/}
                </div>
            </div>
        </div>;
    }
}
