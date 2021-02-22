export class ImageUtils {

    public convertImageToBlob(imageUrl, type = 'image/jpeg', quality = 0.95): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                canvas.toBlob(resolve, type, quality);
            };
            image.onerror = () => reject(null);
            image.crossOrigin = 'anonymous';
            image.src = imageUrl;
        });
    }
}
