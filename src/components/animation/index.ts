import {BiometricsElement} from "../../element";
import styles from './index.scss';
import "@lottiefiles/lottie-player";

export class BiometricsAnimationElement extends BiometricsElement {

    public static readonly COMPLETED_EVENT = 'completed';

    private player;
    private onCompleteCallback: () => void = null;

    /**
     * @internal
     */
    constructor() {
        super();
    }

    /**
     * @internal
     */
    public static getTagName(): string {
        return 'biometrics-animation';
    }

    protected createStyles(): string {
        return styles;
    }

    protected createContent(): HTMLElement {
        this.player = this.createElement('lottie-player', {
            attributes: {
                autoplay: this.autoPlay,
                loop: this.loop,
                src: this.getAttribute('src')
            },
            listeners: {
                complete: () => {
                    this.triggerEvent(BiometricsAnimationElement.COMPLETED_EVENT);
                    const onCompleteCallback = this.onComplete;
                    if (onCompleteCallback) {
                        onCompleteCallback();
                    }
                }
            }
        });
        return this.player;
    }

    public get autoPlay(): boolean {
        return this.hasAttribute('auto-play') ? Boolean(this.getAttribute('auto-play')) : true
    }

    public set autoPlay(autoPlay: boolean) {
        this.setAttribute('auto-play', String(autoPlay));
        this.player.autoplay = autoPlay;
    }

    public get loop(): boolean {
        return !this.hasAttribute('loop') || this.getAttribute('loop') == 'true';
    }

    public set loop(loop: boolean) {
        this.setAttribute('loop', String(loop));
        this.player.loop = loop;
    }

    public get src(): object | string {
        return this.player.src;
    }

    public set src(src: object | string) {
        this.player.load(src);
    }

    public play() {
        this.player.play();
    }

    public pause() {
        this.player.pause();
    }

    public stop() {
        this.player.stop();
    }

    public get onComplete(): () => void {
        return this.onCompleteCallback;
    }

    public set onComplete(callback: () => void) {
        this.onCompleteCallback = callback;
    }
}

BiometricsAnimationElement.register();
