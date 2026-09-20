export interface CropConfig {
  aspectRatio: number; // e.g. 1 (1:1) or 3 (3:1)
  maxWidth: number;
  maxHeight: number;
  maxKb: number;
}

export const CROP_CONFIGS: Record<'logo' | 'capa' | 'produto' | 'categoria', CropConfig> = {
  logo: {
    aspectRatio: 1, // 1:1
    maxWidth: 400,
    maxHeight: 400,
    maxKb: 60, // ~60 KB
  },
  capa: {
    aspectRatio: 3, // 3:1 (1600x533)
    maxWidth: 1600,
    maxHeight: 533,
    maxKb: 200, // ~200 KB
  },
  produto: {
    aspectRatio: 1, // 1:1
    maxWidth: 800,
    maxHeight: 800,
    maxKb: 120, // ~120 KB
  },
  categoria: {
    aspectRatio: 1, // 1:1
    maxWidth: 600,
    maxHeight: 600,
    maxKb: 80, // ~80 KB
  },
};

/**
 * Valida o arquivo de imagem selecionado pelo usuário.
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Formato inválido. Selecione uma imagem JPG, PNG ou WebP.',
    };
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: 'O arquivo é muito grande. O tamanho máximo permitido é 10 MB.',
    };
  }

  return { valid: true };
}

/**
 * Calcula o tamanho aproximado em Bytes de uma string DataURL Base64.
 */
export function getDataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

/**
 * 3. REDUZIR ANTES DE TUDO: Redimensiona a imagem original para no máximo 1600 px
 * no maior lado usando createImageBitmap + canvas em milissegundos.
 */
export async function downscaleImageFile(
  file: File,
  maxDimension: number = 1600
): Promise<{ dataUrl: string; durationMs: number; width: number; height: number }> {
  const startTime = performance.now();

  try {
    let width = 0;
    let height = 0;
    let source: ImageBitmap | HTMLImageElement;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
    } else {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = reject;
        img.src = url;
      });
      width = source.width;
      height = source.height;
    }

    let targetWidth = width;
    let targetHeight = height;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        targetHeight = Math.round((height * maxDimension) / width);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((width * maxDimension) / height);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao obter contexto 2D do Canvas.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    if ('close' in source && typeof source.close === 'function') {
      source.close();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const durationMs = Math.round(performance.now() - startTime);

    console.log(
      `[Upload Stage] Lendo e reduzindo imagem original (${(file.size / (1024 * 1024)).toFixed(2)} MB -> ${width}x${height} para ${targetWidth}x${targetHeight}): ${durationMs} ms`
    );

    return {
      dataUrl,
      durationMs,
      width: targetWidth,
      height: targetHeight,
    };
  } catch (err) {
    console.warn('[ImageProcessor] Falha no createImageBitmap, usando FileReader padrão:', err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        const durationMs = Math.round(performance.now() - startTime);
        resolve({ dataUrl: res, durationMs, width: 800, height: 800 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

/**
 * 4. COMPRESSÃO EFICIENTE: Recorta e comprima em WebP com passo a passo
 * em qualidades (0.85, 0.75, 0.65, 0.55), máximo 4 tentativas.
 */
export async function cropAndCompressImage(
  imageElement: HTMLImageElement,
  cropArea: { x: number; y: number; width: number; height: number },
  tipo: 'logo' | 'capa' | 'produto' | 'categoria'
): Promise<{ dataUrl: string; durationMs: number; finalKb: number }> {
  const startTime = performance.now();
  const config = CROP_CONFIGS[tipo];

  const canvas = document.createElement('canvas');
  canvas.width = config.maxWidth;
  canvas.height = config.maxHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível obter o contexto 2D do Canvas.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    imageElement,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    config.maxWidth,
    config.maxHeight
  );

  // Testar se WebP é suportado no Canvas
  let format = 'image/webp';
  let testUrl = canvas.toDataURL(format, 0.85);
  if (!testUrl.startsWith('data:image/webp')) {
    format = 'image/jpeg';
  }

  const stepQualities = [0.85, 0.75, 0.65, 0.55];
  const maxBytes = config.maxKb * 1024;

  let bestDataUrl = '';
  let bestSize = Infinity;
  let usedQuality = 0.85;

  for (let i = 0; i < stepQualities.length; i++) {
    const q = stepQualities[i];
    const dataUrl = canvas.toDataURL(format, q);
    const sizeBytes = getDataUrlByteSize(dataUrl);

    if (sizeBytes < bestSize) {
      bestDataUrl = dataUrl;
      bestSize = sizeBytes;
      usedQuality = q;
    }

    if (sizeBytes <= maxBytes) {
      const durationMs = Math.round(performance.now() - startTime);
      const finalKb = Math.round(sizeBytes / 1024);
      console.log(
        `[Upload Stage] Recortando e comprimindo (${tipo}, passo ${i + 1}/4, qualidade ${q}, ${finalKb} KB): ${durationMs} ms`
      );
      return { dataUrl, durationMs, finalKb };
    }
  }

  const durationMs = Math.round(performance.now() - startTime);
  const finalKb = Math.round(bestSize / 1024);
  console.log(
    `[Upload Stage] Recortando e comprimindo (${tipo}, melhor resultado ${finalKb} KB em ${stepQualities.length} passos): ${durationMs} ms`
  );

  return { dataUrl: bestDataUrl, durationMs, finalKb };
}

/**
 * Normaliza strings tirando acentos, espaços e caracteres especiais para correspondência automática do envio em lote.
 */
export function normalizeStringForMatching(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
