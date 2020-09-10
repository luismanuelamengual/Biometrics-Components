import {Component, EventEmitter, Event, h, Host, Prop, State} from '@stencil/core';
import bodymovin from 'bodymovin';

// @ts-ignore
import loadingAnimationData from './animations/loading.json';

// @ts-ignore
import failAnimationData from './animations/fail.json';

// @ts-ignore
import successAnimationData from './animations/success.json';

@Component({
  tag: 'biometrics-liveness-passive',
  styleUrl: 'liveness_passive.scss',
  shadow: true
})
export class Liveness_passive {

    @Prop() serverUrl: string;

    @Prop() apiKey: string;

    @Prop() maxPictureWidth = 720;

    @Prop() maxPictureHeight = 600;

    @State() cameraOpen = true;

    @State() picture: string;

    @State() verifying = false;

    @State() livenessVerified = false;

    @Event() livenessVerificationComplete: EventEmitter;

    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;

    constructor() {
        this.onPictureCaptured = this.onPictureCaptured.bind(this);
    }

    componentDidLoad() {
        this.initializeAnimations();
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
            this.livenessVerificationComplete.emit({livenessVerified: false, picture: this.picture});
        });
        this.successAnimation = bodymovin.loadAnimation({
            renderer: 'svg',
            autoplay: false,
            loop: false,
            animationData: successAnimationData,
            container: this.successAnimationElement
        });
        this.successAnimation.addEventListener('complete', () => {
             this.livenessVerificationComplete.emit({livenessVerified: true, picture: this.picture});
        });
    }

    async onPictureCaptured(event) {
        this.picture = event.detail;
        this.cameraOpen = false;
        this.verifying = true;
        this.loadingAnimation.goToAndPlay(0, true);
        let url = this.serverUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'v1/check_liveness_image';
        let response: any = await fetch (url, {
            method: 'post',
            body: this.convertImageToBlob(this.picture),
            headers: {
                'Authorization': 'Bearer ' + this.apiKey
            }
        });
        this.verifying = false;
        response = await response.json();
        if (response.data.status === 0 && response.data.liveness) {
            this.livenessVerified = true;
            this.successAnimation.goToAndPlay(0, true);
        } else {
            this.livenessVerified = false;
            this.failAnimation.goToAndPlay(0, true);
        }
    }

    convertImageToBlob(dataURI): Blob {
        let byteString;
        const dataURITokens = dataURI.split(',');
        if (dataURITokens[0].indexOf('base64') >= 0) {
            byteString = atob(dataURITokens[1]);
        } else {
            byteString = this.convertImageToBlob(dataURITokens[1]);
        }
        const ia = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ia], {type: 'image/jpeg'});
    }

    render() {
        return <Host>
            <div class={{'liveness-panel': true, 'hidden': this.cameraOpen}}>
                <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': !this.verifying}}/>
                <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.verifying || !this.livenessVerified}}/>
                <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.verifying || this.livenessVerified}}/>
            </div>
            {this.cameraOpen && this.renderCamera()}
        </Host>;
    }

    renderCamera() {
        return <biometrics-camera facingMode="user" maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight} onPictureCaptured={this.onPictureCaptured}>
            <div class="camera-caption-container">
                <p class="camera-caption">Ubice su rostro dentro del recuadro y tome la foto</p>
            </div>
            <div class={{ 'marquee': true }}>
                <div class='marquee-corner marquee-corner-nw'/>
                <div class='marquee-corner marquee-corner-ne'/>
                <div class='marquee-corner marquee-corner-sw'/>
                <div class='marquee-corner marquee-corner-se'/>
            </div>
        </biometrics-camera>;
    }
}
