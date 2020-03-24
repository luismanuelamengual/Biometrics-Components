import {Component, h, Prop, Element, Listen} from '@stencil/core';
import bodymovin from 'bodymovin';

// @ts-ignore
import checkAnimationData from './animations/check.animation.json';
// @ts-ignore
import pointAnimationData from './animations/point.animation.json';
// @ts-ignore
import maskAnimationData from './animations/mask.animation.json';

@Component({
  tag: 'biometrics-liveness',
  styleUrl: 'biometrics-liveness.scss',
  shadow: true
})
export class BiometricsLiveness {

    readonly MASK_ANIMATION_MAX_FRAMES = 60;

    @Element() host: HTMLElement;

    @Prop() serverUrl: string = 'https://dev-bmc322.globant.com/biometrics/';

    @Prop() autoStart = false;

    videoElement!: HTMLVideoElement;
    videoOverlayElement!: HTMLDivElement;
    maskAnimationElement: HTMLDivElement;
    maskAnimation = null;
    maskAnimationInProgress = false;
    maskAnimationTargetFrame = 0;
    maskAnimationRequestedFrame = 0;

    componentDidLoad() {
        this.initVideo();
        this.initAnimations();
    }

    componentDidUnload() {
        this.finalizeVideo();
    }

    @Listen('resize', { target: 'window' })
    handleResize() {
        this.adjustVideoOverlay();
    }


    initAnimations() {
        /*this.pointAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: true,
            loop: true,
            animationData: pointAnimationData,
            container: this.livenessPointAnimationElement.nativeElement
        });
        this.checkAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: checkAnimationData,
            container: this.livenessCheckAnimationElement.nativeElement
        });
        this.checkAnimation.addEventListener('complete', () => {
            this.onLivenessSessionCompleted();
        });*/
        this.maskAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: maskAnimationData,
            container: this.maskAnimationElement
        });
        /*this.maskAnimation.addEventListener('complete', () => {
            if (this.maskAnimationTargetFrame != null && this.maskAnimationTargetFrame !== this.maskAnimationRequestedFrame) {
                this.animateMask(this.maskAnimationRequestedFrame, this.maskAnimationTargetFrame);
                this.maskAnimationRequestedFrame = this.maskAnimationTargetFrame;
            } else {
                this.maskAnimationInProgress = false;
            }
        });*/
        this.maskAnimation.setSpeed(2);
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

    requestMaskAnimation(frame) {
        if (frame !== this.maskAnimationRequestedFrame) {
            if (!this.maskAnimationInProgress) {
                this.maskAnimationTargetFrame = null;
                this.maskAnimationInProgress = true;
                this.animateMask(this.maskAnimationRequestedFrame, frame);
                this.maskAnimationRequestedFrame = frame;
            } else {
                this.maskAnimationTargetFrame = frame;
            }
        }
    }

    animateMask(fromFrame, toFrame) {
        if (fromFrame !== toFrame) {
            this.maskAnimation.setDirection(toFrame >= fromFrame ? 1 : -1);
            this.maskAnimation.playSegments([fromFrame, toFrame], true);
        }
    }

    adjustVideoOverlay() {
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
                    <div ref={(el) => this.maskAnimationElement = el as HTMLDivElement} class={{
                        'liveness-mask-animation': true,
                        'liveness-hidden': false/*livenessMode=='point' || !livenessSessionRunning || livenessStatus < 0*/
                    }}></div>


                    {/*
                    <div #livenessPointAnimation [ngClass]="{'liveness-point-animation': true, 'liveness-hidden': livenessMode=='mask' || !livenessSessionRunning, 'liveness-point-animation-left': livenessInstruction == 'left_profile_face', 'liveness-point-animation-right': livenessInstruction == 'right_profile_face'}"></div>
                    <ng-container *ngIf="livenessSessionRunning">
                        <app-liveness-marquee [ngClass]="{'liveness-hidden': livenessMode=='mask' && livenessStatus >= 0}"></app-liveness-marquee>
                    </ng-container>*/}
                </div>
            </div>
        </div>;
    }
}
