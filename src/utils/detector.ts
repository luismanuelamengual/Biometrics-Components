export class Detector {

    private classifiers = [];

    public async loadClassifierFromUrl(classifierName: string, classifierUrl: string): Promise<boolean> {
        let classifierLoaded = false;
        if (this.classifiers[classifierName]) {
            classifierLoaded = true;
        } else {
            try {
                const response = await fetch(classifierUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    this.loadClassifier(classifierName, new Int8Array(buffer));
                    classifierLoaded = true;
                }
            } catch (e) {}
        }
        return classifierLoaded;
    }

    public loadClassifier(classifierName: string, bytes: Int8Array) {
        if (!this.classifiers[classifierName]) {
            const dview = new DataView(new ArrayBuffer(4));
            let p = 8;
            dview.setUint8(0, bytes[p]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
            const tdepth = dview.getInt32(0, true);
            p = p + 4;
            dview.setUint8(0, bytes[p]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
            const ntrees = dview.getInt32(0, true);
            p = p + 4;
            const tcodes_ls = [];
            const tpreds_ls = [];
            const thresh_ls = [];
            for (let t = 0; t < ntrees; ++t) {
                Array.prototype.push.apply(tcodes_ls, [0, 0, 0, 0]);
                Array.prototype.push.apply(tcodes_ls, bytes.slice(p, p + 4 * Math.pow(2, tdepth) - 4));
                p = p + 4 * Math.pow(2, tdepth) - 4;
                for (let i = 0; i < Math.pow(2, tdepth); ++i) {
                    dview.setUint8(0, bytes[p]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
                    tpreds_ls.push(dview.getFloat32(0, true));
                    p = p + 4;
                }
                dview.setUint8(0, bytes[p]), dview.setUint8(1, bytes[p + 1]), dview.setUint8(2, bytes[p + 2]), dview.setUint8(3, bytes[p + 3]);
                thresh_ls.push(dview.getFloat32(0, true));
                p = p + 4;
            }
            const tcodes = new Int8Array(tcodes_ls);
            const tpreds = new Float32Array(tpreds_ls);
            const thresh = new Float32Array(thresh_ls);
            this.classifiers[classifierName] = function (r, c, s, pixels, ldim) {
                r = 256 * r;
                c = 256 * c;
                let root = 0;
                let o = 0.0;
                const pow2tdepth = Math.pow(2, tdepth) >> 0;
                for (let i = 0; i < ntrees; ++i) {
                    let idx = 1;
                    for (let j = 0; j < tdepth; ++j) {
                        const i1 = ((r + tcodes[(root + 4 * idx)] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 1] * s) >> 8);
                        const i2 = ((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim + ((c + tcodes[root + 4 * idx + 3] * s) >> 8);
                        idx = 2 * idx + (pixels[i1] <= pixels[i2] ? 1 : 0);
                    }
                    o = o + tpreds[pow2tdepth * i + idx - pow2tdepth];
                    if (o <= thresh[i]) {
                        return -1;
                    }
                    root += 4 * pow2tdepth;
                }
                return o - thresh[ntrees - 1];
            };
        }
    }

    public detect(classifierName: string, image: ImageData, config: {shiftFactor?: number, minSize?: number, maxSize?: number, scaleFactor?: number, iouThreshold?: number} = {}) {
        let detections = [];
        const classifier = this.classifiers[classifierName];
        if (classifier) {
            const imageData = image.data;
            const imagePixels = new Uint8Array(image.height * image.width);
            for(let r = 0; r < image.height; ++r) {
                for(let c = 0; c < image.width; ++c) {
                    imagePixels[r*image.width + c] = (2 * imageData[(r * 4 * image.width + 4 * c)] + 7 * imageData[r * 4 *image.width + 4 * c + 1] + imageData[r * 4 * image.width + 4 * c + 2]) / 10;
                }
            }
            config = Object.assign({
                shiftFactor: 0.1,
                minSize: 100,
                maxSize: 1000,
                scaleFactor: 1.1,
                iouThreshold: 0.2
            }, config);
            let scale = config.minSize;
            while (scale <= config.maxSize) {
                const step = Math.max(config.shiftFactor * scale, 1) >> 0;
                const offset = (scale / 2 + 1) >> 0;
                for (let r = offset; r <= image.height - offset; r += step) {
                    for (let c = offset; c <= image.width - offset; c += step) {
                        const q = classifier(r, c, scale, imagePixels, image.width);
                        if (q > 0.0) {
                            detections.push([r, c, scale, q]);
                        }
                    }
                }
                scale = scale * config.scaleFactor;
            }
            detections = detections.sort((a, b) => b[3] - a[3]);
            function calculate_iou(det1, det2) {
                const r1 = det1[0], c1 = det1[1], s1 = det1[2];
                const r2 = det2[0], c2 = det2[1], s2 = det2[2];
                const overr = Math.max(0, Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2));
                const overc = Math.max(0, Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2));
                return overr * overc / (s1 * s1 + s2 * s2 - overr * overc);
            }
            const assignments = new Array(detections.length).fill(0);
            const clusters = [];
            for (let i = 0; i < detections.length; ++i) {
                if (assignments[i] == 0) {
                    let r = 0.0, c = 0.0, s = 0.0, q = 0.0, n = 0;
                    for (let j = i; j < detections.length; ++j) {
                        if (calculate_iou(detections[i], detections[j]) > config.iouThreshold) {
                            assignments[j] = 1;
                            r = r + detections[j][0];
                            c = c + detections[j][1];
                            s = s + detections[j][2];
                            q = q + detections[j][3];
                            n = n + 1;
                        }
                    }
                    clusters.push([r / n, c / n, s / n, q]);
                }
            }
            detections = clusters;
        }
        return detections;
    }
}
