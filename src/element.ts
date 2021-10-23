export abstract class BiometricsElement extends HTMLElement {

    protected constructor(useShadow = false) {
        super();
        if (useShadow) {
            this.attachShadow({mode: 'open'});
        }
    }

    /**
     * @internal
     */
    public connectedCallback() {
        // @ts-ignore
        const stylesId = ((this.constructor).getTagName() + '-styles').toLowerCase();
        this.attachStyles(stylesId, () => this.createStyles());
        const content = this.createContent();
        if (content) {
            const container = this.getContainer();
            if (typeof content === 'string') {
                container.innerHTML = content;
            } else if (content instanceof Array) {
                for(const contentElement of content) {
                    container.appendChild(contentElement);
                }
            } else {
                container.appendChild(content);
            }
        }
        this.onConnected();
    }

    /**
     * @internal
     */
    public disconnectedCallback() {
        this.onDisconnected();
    }

    /**
     * @internal
     */
    public static getTagName(): string {
        throw new Error('Static method \"getTagName()\" was not found in class \"' + this.name + '\" !!');
    }

    /**
     * @internal
     */
    public static register() {
        const tagName = this.getTagName();
        if (!customElements.get(tagName)) {
            // @ts-ignore
            customElements.define(tagName, this);
        }
    }

    protected getContainer(): ShadowRoot | HTMLElement {
        return (this.shadowRoot) ? this.shadowRoot : this;
    }

    protected appendElement<Type extends HTMLElement>(element: Type): Type {
        return this.getContainer().appendChild(element);
    }

    protected findElement<Type extends HTMLElement>(selector: string): Type {
        return this.getContainer().querySelector(selector);
    }

    protected findAllElements<Type extends HTMLElement>(selector: string): NodeListOf<Type> {
        return this.getContainer().querySelectorAll(selector);
    }

    protected triggerEvent(eventName: string, data?: any) {
        const event = data ? new CustomEvent(eventName, { detail: data }) : new Event(eventName);
        this.dispatchEvent(event);
    }

    protected attachStyles(stylesId: string, stylesCreator: () => string) {
        if (this.shadowRoot) {
            let stylesAppended = false;

            if (!(window as any).CSSStyleSheetsUnsupported) {
                try {
                    let styleSheets: Map<string, CSSStyleSheet> = (window as any).CSSStyleSheets;
                    if (!styleSheets) {
                        styleSheets = new Map<string, CSSStyleSheet>();
                        (window as any).CSSStyleSheets = styleSheets;
                    }
                    let styleSheet = styleSheets.get(stylesId);
                    if (!styleSheet) {
                        styleSheet = new CSSStyleSheet();
                        (styleSheet as any).replaceSync(stylesCreator());
                        styleSheets.set(stylesId, styleSheet);
                    }
                    const adoptedStyleSheets = (this.shadowRoot as any).adoptedStyleSheets;
                    (this.shadowRoot as any).adoptedStyleSheets = adoptedStyleSheets.concat([styleSheet]);
                    stylesAppended = true;
                } catch (e) {
                    (window as any).CSSStyleSheetsUnsupported = true;
                }
            }

            if (!stylesAppended) {
                if (!this.shadowRoot.getElementById(stylesId)) {
                    this.shadowRoot.appendChild(this.createElement('style', {attributes: {id: stylesId}}, stylesCreator()));
                }
            }
        } else {
            if (!document.getElementById(stylesId)) {
                document.querySelector('head').appendChild(this.createElement('style', {attributes: {id: stylesId}}, stylesCreator()));
            }
        }
    }

    protected createElement<Type extends HTMLElement>(tagName: string): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, content: string): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, children: Array<HTMLElement>): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, options: string | Array<HTMLElement> | {classes?: string|Array<string>|{[key: string]: boolean}, attributes?: {[key: string]: any;}, listeners?: {[key: string]: (Event) => void}}): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, options: string | Array<HTMLElement> | {classes?: string|Array<string>|{[key: string]: boolean}, attributes?: {[key: string]: any;}, listeners?: {[key: string]: (Event) => void}}, content: string): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, options: string | Array<HTMLElement> | {classes?: string|Array<string>|{[key: string]: boolean}, attributes?: {[key: string]: any;}, listeners?: {[key: string]: (Event) => void}}, chidren: Array<HTMLElement>): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, options: string | Array<HTMLElement> | {classes?: string|Array<string>|{[key: string]: boolean}, attributes?: {[key: string]: any;}, listeners?: {[key: string]: (Event) => void}}, chidren: HTMLElement): Type;
    protected createElement<Type extends HTMLElement>(tagName: string, options?: string | Array<HTMLElement> | {classes?: string|Array<string>|{[key: string]: boolean}, attributes?: {[key: string]: any;}, listeners?: {[key: string]: (Event) => void}}, content?: string | HTMLElement | Array<HTMLElement>): Type {
        const element = document.createElement(tagName);
        function insertContent(content: string|HTMLElement|Array<HTMLElement>) {
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                element.appendChild(content);
            } else if (content instanceof Array) {
                for (const childElement of content) {
                    element.appendChild(childElement);
                }
            }
        }
        if (options) {
            if (typeof options === 'string' || options instanceof Array) {
                insertContent(options);
            } else {
                if (options.classes) {
                    if (typeof options.classes === 'string') {
                        element.classList.add(options.classes);
                    } else if (options.classes instanceof Array) {
                        element.classList.add(...options.classes);
                    } else {
                        for (const className in options.classes) {
                            if (options.classes[className]) {
                                element.classList.add(className);
                            }
                        }
                    }
                }
                if (options.attributes) {
                    for (const key in options.attributes) {
                        const value = options.attributes[key];
                        if (value) {
                            element.setAttribute(key, value);
                        }
                    }
                }
                if (options.listeners) {
                    for (const eventName in options.listeners) {
                        element.addEventListener(eventName, options.listeners[eventName]);
                    }
                }
            }
            if (content) {
                insertContent(content);
            }
        }
        return element as Type;
    }

    protected createStyles(): string {
        return '';
    }

    protected createContent(): string | HTMLElement | Array<HTMLElement> {
        return this.shadowRoot ? '<slot></slot>' : null;
    }

    protected onConnected(): void {}
    protected onDisconnected(): void {}
}
