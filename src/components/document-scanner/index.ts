import {BiometricsElement} from "../../element";
import styles from './index.scss';
import {BrowserMultiFormatReader} from '@zxing/library';
import {BiometricsCameraElement} from "../camera";

/**
 * @ignore
 */
export declare enum Gender {
    MALE = "M",
    FEMALE = "F"
}

/**
 * @ignore
 */
export interface DocumentData {
    firstName?: string;
    lastName?: string;
    documentNumber?: number;
    gender?: Gender;
    birthDate?: Date;
    nationalIdentificationNumber?: number;
}

/**
 * @ignore
 */
export class BiometricsDocumentScannerElement extends BiometricsElement {

    public static readonly DOCUMENT_SCAN_EVENT = 'documentScan';
    public static readonly DOCUMENT_SCAN_ERROR_EVENT = 'documentScanError';

    readonly NAME_PATTERN = '(?:[a-zA-Z]|\\s|`)+';
    readonly NUMBER_PATTERN = '\\d+';
    readonly GENDER_PATTERN = '(?:M|F)';
    readonly DATE_PATTERN = '\\d\\d\\/\\d\\d\\/\\d{4}';
    readonly UPPER_CASE_LETTER_PATTERN = '[A-Z]';
    readonly DIGIT_PATTERN = '\\d';
    readonly PDF417_PATTERN_TYPE_1 = new RegExp('^' + this.NUMBER_PATTERN + '@' + this.NAME_PATTERN + '@' + this.NAME_PATTERN + '@' + this.GENDER_PATTERN + '@' + this.NUMBER_PATTERN + '@' + this.UPPER_CASE_LETTER_PATTERN + '@' + this.DATE_PATTERN);
    readonly PDF417_PATTERN_TYPE_2 = new RegExp('^@' + this.NUMBER_PATTERN + '\\s*@' + this.UPPER_CASE_LETTER_PATTERN + '@' + this.DIGIT_PATTERN + '@' + this.NAME_PATTERN + '@' + this.NAME_PATTERN + '@' + this.NAME_PATTERN + '@' + this.DATE_PATTERN + '@' + this.GENDER_PATTERN + '@');

    private reader: BrowserMultiFormatReader;
    private cameraElement: BiometricsCameraElement;
    private decodeTask: any;

    constructor() {
        super(true);
        this.reader = new BrowserMultiFormatReader();
    }

    protected onConnected() {
        this.startBarcodeDecoding();
    }

    protected onDisconnected() {
        this.stopBarcodeDecoding();
    }

    private startBarcodeDecoding() {
        this.stopBarcodeDecoding();
        this.decodeTask = setInterval(() => {
            this.decodeImage();
        }, 1000);
    }

    private stopBarcodeDecoding() {
        if (this.decodeTask) {
            clearInterval(this.decodeTask);
            this.decodeTask = null;
        }
    }

    private async decodeImage() {
        try {
            const imageUrl = await this.cameraElement.getSnapshotUrl();
            const result = await this.reader.decodeFromImageUrl(imageUrl);
            const code = result.getText();
            if (code) {
                try {
                    const documentData = this.parseCode(code);
                    this.triggerEvent(BiometricsDocumentScannerElement.DOCUMENT_SCAN_EVENT, documentData);
                } catch (e) {
                    this.triggerEvent(BiometricsDocumentScannerElement.DOCUMENT_SCAN_ERROR_EVENT, e);
                }
            }
        } catch (e) {}
    }

    public static getTagName(): string {
        return 'biometrics-document-scanner';
    }

    protected createStyles(): string {
        return styles;
    }

    protected createContent(): string | HTMLElement | Array<HTMLElement> {
        this.cameraElement = this.createElement('biometrics-camera', {attributes: {controls: 'false'}});
        const diodeElement = this.createElement('div', {classes: 'diode'}, [this.createElement('div', {classes: 'laser'})]);
        const maskElement = this.createElement('div', {classes: 'mask'}, [diodeElement]);
        return this.createElement('div', {classes: 'container'}, [this.cameraElement, maskElement]);
    }

    private parseCode(code: string): DocumentData {
        const data: DocumentData = {};
        if (this.PDF417_PATTERN_TYPE_1.test(code)) {
            const fields = code.split('@');
            data.firstName = this.formatName(fields[2]);
            data.lastName = this.formatName(fields[1]);
            data.documentNumber = this.formatDocument(fields[4]);
            data.gender = this.formatGender(fields[3]);
            data.birthDate = this.formatBirthDate(fields[6]);
            data.nationalIdentificationNumber = this.formatNationalIdentificationNumber(fields[0]);
        } else if (this.PDF417_PATTERN_TYPE_2.test(code)) {
            const fields = code.split('@');
            data.firstName = this.formatName(fields[5]);
            data.lastName = this.formatName(fields[4]);
            data.documentNumber = this.formatDocument(fields[1]);
            data.gender = this.formatGender(fields[8]);
            data.birthDate = this.formatBirthDate(fields[7]);
            data.nationalIdentificationNumber = this.formatNationalIdentificationNumber(fields[10]);
        } else {
            throw new Error('Unrecognized code: "' + code + '"');
        }
        return data;
    }

    private formatName(name: string): string {
        return name.trim().toLowerCase().split(' ').map((value) => value.charAt(0).toUpperCase() + value.substring(1)).join(' ');
    }

    private formatDocument(document: string): number {
        return parseInt(document.replace(/[^0-9]/g, ''), 10);
    }

    private formatGender(gender: string): Gender {
        return gender as Gender;
    }

    private formatBirthDate(birthDate: string): Date {
        const [date, month, year] = birthDate.split('/').map((value) => parseInt(value, 10));
        return new Date(year, month - 1, date);
    }

    private formatNationalIdentificationNumber(nationalIdentificationNumber: string): number {
        return parseInt(nationalIdentificationNumber, 10);
    }
}

BiometricsDocumentScannerElement.register();
