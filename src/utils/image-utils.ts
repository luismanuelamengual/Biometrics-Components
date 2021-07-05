export class ImageUtils {

    public static convertImageToBlob(imageUrl, type = 'image/jpeg', quality = 0.95): Promise<Blob> {
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

    public static convertBlobToImage(image: Blob): Promise<string> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(image);
            reader.onloadend = () => resolve(reader.result as string);
        });
    }
}
