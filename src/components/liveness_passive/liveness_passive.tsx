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

    @State() cameraOpen = false;

    @State() picture: string;

    @State() caption: string;

    @State() captionStyle: 'normal' | 'danger' = 'normal';

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

    componentWillLoad() {
        this.openCamera();
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

    openCamera() {
        this.setCaption('Ubique su rostro dentro del recuadro y tome la foto');
        this.cameraOpen = true;
    }

    closeCamera() {
        this.setCaption('');
        this.cameraOpen = false;
    }

    setCaption(caption: string, style: 'normal' | 'danger' = 'normal') {
        this.caption = caption;
        this.captionStyle = style;
    }

    async onPictureCaptured(event) {
        this.picture = event.detail;
        this.closeCamera();
        this.verifying = true;
        this.loadingAnimation.goToAndPlay(0, true);
        let url = this.serverUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'v1/check_liveness_image';
        let response: any = await fetch (url, {
            method: 'post',
            body: await this.convertImageToBlob(this.picture),
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
            switch (response.data.status) {
                case 0:
                    this.setCaption('La prueba de vida no ha sido superada. Por favor vuelva a intentarlo', 'danger');
                    break;
                case -1:
                    this.setCaption('No se ha encontrado el rostro en la imagen', 'danger');
                    break;
                case -2:
                    this.setCaption('El rostro no esta centrado. Vuelva a intentarlo con el rostro dentro del recuadro', 'danger');
                    break;
                case -3:
                    this.setCaption('El rostro se ha encontrado demasiado cerca en la imagen', 'danger');
                    break;
                case -4:
                    this.setCaption('El rostro se ha encontrado demasiado lejos en la imagen', 'danger');
                    break;
            }
            this.livenessVerified = false;
            this.failAnimation.goToAndPlay(0, true);
        }
    }

    public convertImageToBlob(imageUrl): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                canvas.toBlob(resolve, 'image/jpeg', 0.75);
            };
            image.onerror = () => reject(null);
            image.crossOrigin = 'anonymous';
            image.src = imageUrl;
        });
    }

    render() {
        return <Host>
            <div class={{'liveness-panel': true, 'hidden': this.cameraOpen}}>
                <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': !this.verifying}}/>
                <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.verifying || !this.livenessVerified}}/>
                <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.verifying || this.livenessVerified}}/>
            </div>
            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}}>{this.caption}</p>
            </div>}
            {this.cameraOpen && this.renderCamera()}
        </Host>;
    }

    renderCamera() {
        return <biometrics-camera facingMode="user" maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight} onPictureCaptured={this.onPictureCaptured}>
            <div class={{ 'marquee': true }}>
                <div class='marquee-corner marquee-corner-nw'/>
                <div class='marquee-corner marquee-corner-ne'/>
                <div class='marquee-corner marquee-corner-sw'/>
                <div class='marquee-corner marquee-corner-se'/>
            </div>
        </biometrics-camera>;
    }
}
