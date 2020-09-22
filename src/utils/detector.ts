export class Detector {

    private classifiers = [];
    private memoryUpdateFn;

    constructor(memorySize = 1) {
        this.setMemorySize(memorySize);
    }

    public setMemorySize(size) { //todo: memory no hace falta una función de callback
        let n = 0;
        const memory = [];
        for (let i = 0; i < size; ++i) {
            memory.push([]);
        }
        this.memoryUpdateFn = function(dets) {
            memory[n] = dets;
            n = (n + 1) % memory.length;
            dets = [];
            for (let i = 0; i < memory.length; ++i) {
                dets = dets.concat(memory[i]);
            }
            return dets;
        };
    }

    public loadClassifier(classifierName: string, bytes: Int8Array) {
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
        this.classifiers[classifierName] = function(r, c, s, pixels, ldim) {
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

    public detect(classifierName: string, image, params: {shiftFactor?: number, minSize?: number, maxSize?: number, scaleFactor?: number, iouThreshold?: number} = {}) {
        let detections = [];
        const classifier = this.classifiers[classifierName];
        if (classifier) {
            const pixels = image.pixels;
            const nrows = image.nrows;
            const ncols = image.ncols;
            const ldim = image.ldim;
            params = Object.assign({
                shiftFactor: 0.1,
                minSize: 100,
                maxSize: 1000,
                scaleFactor: 1.1,
                iouThreshold: 0.2
            }, params);
            let scale = params.minSize;
            while (scale <= params.maxSize) {
                const step = Math.max(params.shiftFactor * scale, 1) >> 0;
                const offset = (scale / 2 + 1) >> 0;
                for (let r = offset; r <= nrows - offset; r += step) {
                    for (let c = offset; c <= ncols - offset; c += step) {
                        const q = classifier(r, c, scale, pixels, ldim);
                        if (q > 0.0)
                            detections.push([r, c, scale, q]);
                    }
                }
                scale = scale * params.scaleFactor;
            }
            detections = this.memoryUpdateFn(detections);

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
                        if (calculate_iou(detections[i], detections[j]) > params.iouThreshold) {
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
