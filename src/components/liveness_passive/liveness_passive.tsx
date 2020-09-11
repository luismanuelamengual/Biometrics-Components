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

    @State() activeAnimation!: 'loading' | 'success' | 'fail';

    @State() livenessVerificationFinished = false;

    @Event() livenessVerificationComplete: EventEmitter;

    loadingAnimationElement!: HTMLDivElement;
    successAnimationElement!: HTMLDivElement;
    failAnimationElement!: HTMLDivElement;
    loadingAnimation = null;
    successAnimation = null;
    failAnimation = null;

    constructor() {
        this.onPictureCaptured = this.onPictureCaptured.bind(this);
        this.onRestartButtonClick = this.onRestartButtonClick.bind(this);
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
            this.livenessVerificationFinished = true;
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
             this.livenessVerificationFinished = true;
        });
    }

    openCamera() {
        this.setCaption('Ubique su rostro dentro del recuadro y tome la foto');
        this.cameraOpen = true;
        this.livenessVerificationFinished = false;
    }

    closeCamera() {
        this.setCaption('');
        this.cameraOpen = false;
    }

    setCaption(caption: string, style: 'normal' | 'danger' = 'normal') {
        this.caption = caption;
        this.captionStyle = style;
    }

    runAnimation(animation: 'loading' | 'success' | 'fail') {
        this.activeAnimation = animation;
        switch (this.activeAnimation) {
            case 'loading':
                this.loadingAnimation.goToAndPlay(0, true);
                break;
            case 'success':
                this.successAnimation.goToAndPlay(0, true);
                break;
            case 'fail':
                this.failAnimation.goToAndPlay(0, true);
                break;
        }
    }

    async onPictureCaptured(event) {
        this.picture = event.detail;
        this.closeCamera();
        this.runAnimation('loading');
        let url = this.serverUrl;
        if (!url.endsWith('/')) {
            url += '/';
        }
        url += 'v1/check_liveness_image';
        let response: any = null;
        try {
            response = await fetch(url, {
                method: 'post',
                body: await this.convertImageToBlob(this.picture),
                headers: {
                    'Authorization': 'Bearer ' + this.apiKey
                }
            });
            response = await response.json();
        } catch (e) {
            this.setCaption('Error de comunicación', 'danger');
            this.runAnimation('fail');
        }

        if (response) {
            if (response.data.status === 0 && response.data.liveness) {
                this.runAnimation('success');
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
                this.runAnimation('fail');
            }
        }
    }

    onRestartButtonClick() {
        this.openCamera();
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
                <div ref={(el) => this.loadingAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'loading'}}/>
                <div ref={(el) => this.successAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'success'}}/>
                <div ref={(el) => this.failAnimationElement = el as HTMLDivElement} class={{'liveness-animation': true, 'hidden': this.activeAnimation !== 'fail'}}/>
                <img src={this.picture} />
                {this.livenessVerificationFinished && <div class="liveness-buttons-wrapper">
                    <button class="liveness-start-button" onClick={this.onRestartButtonClick} >Volver a verificar</button>
                </div>}
            </div>
            {this.caption && <div class="caption-container">
                <p class={{'caption': true, 'caption-danger': this.captionStyle === 'danger'}}>{this.caption}</p>
            </div>}
            {this.cameraOpen && this.renderCamera()}
        </Host>;
    }

    renderCamera() {
        return <biometrics-camera facingMode="user" type="fullscreen" maxPictureWidth={this.maxPictureWidth} maxPictureHeight={this.maxPictureHeight} onPictureCaptured={this.onPictureCaptured}>
            <div class={{ 'marquee': true }}>
                <div class='marquee-corner marquee-corner-nw'/>
                <div class='marquee-corner marquee-corner-ne'/>
                <div class='marquee-corner marquee-corner-sw'/>
                <div class='marquee-corner marquee-corner-se'/>
            </div>
        </biometrics-camera>;
    }
}
