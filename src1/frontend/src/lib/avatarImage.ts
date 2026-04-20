const MAX_AVATAR_SIZE = 256;
const AVATAR_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Bild konnte nicht geladen werden."));
    };
    image.src = objectUrl;
  });
}

export async function createAvatarDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const longestSide = Math.max(image.width, image.height, 1);
  const scale = Math.min(1, MAX_AVATAR_SIZE / longestSide);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Bildverarbeitung wird von diesem Browser nicht unterstützt.");
  }

  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", AVATAR_QUALITY);

  if (dataUrl.length > 1_500_000) {
    throw new Error("Das Bild ist auch nach dem Verkleinern noch zu groß. Bitte ein kleineres Bild wählen.");
  }

  return dataUrl;
}
