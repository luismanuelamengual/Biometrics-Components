import {BiometricsElement} from "../../element";
import styles from './index.scss';
import "@lottiefiles/lottie-player";

export class BiometricsAnimationElement extends BiometricsElement {

    public static readonly COMPLETED_EVENT = 'completed';

    private _player;

    /**
     * @internal
     */
    constructor() {
        super();
        this.onCompleted = this.onCompleted.bind(this);
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

    protected createContent(): string | HTMLElement | Array<HTMLElement> {
        this._player = this.createElement('lottie-player', { attributes: { autoplay: this.autoPlay, loop: this.loop, src: this.getAttribute('src') }, listeners: { complete: this.onCompleted }});
        return this._player;
    }

    public get autoPlay(): boolean {
        return this.hasAttribute('auto-play') ? Boolean(this.getAttribute('auto-play')) : true
    }

    public set autoPlay(autoPlay: boolean) {
        this.setAttribute('auto-play', String(autoPlay));
        this._player.autoplay = autoPlay;
    }

    public get loop(): boolean {
        return !this.hasAttribute('loop') || this.getAttribute('loop') == 'true';
    }

    public set loop(loop: boolean) {
        this.setAttribute('loop', String(loop));
        this._player.loop = loop;
    }

    public get src(): object | string {
        return this._player.src;
    }

    public set src(src: object | string) {
        this._player.load(src);
    }

    public play() {
        this._player.play();
    }

    public pause() {
        this._player.pause();
    }

    public stop() {
        this._player.stop();
    }

    private onCompleted() {
        this.triggerEvent(BiometricsAnimationElement.COMPLETED_EVENT);
    }
}

BiometricsAnimationElement.register();
