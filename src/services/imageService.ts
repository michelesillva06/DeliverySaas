import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';

export interface UploadImageParams {
  storeId: string;
  tipo: 'logo' | 'capa' | 'produto' | 'categoria';
  id?: string;
  fileDataUrl: string; // Base64 data URL string
}

export interface UploadImageResult {
  url: string;
  method: 'storage' | 'firestore_dataurl';
  storagePath?: string;
  durationMs: number;
}

const STORAGE_DISABLED_KEY = 'pedesai_firebase_storage_disabled';

/**
 * Envia a imagem com timeout estrito de 6 segundos no Storage.
 * Se falhar ou estourar o tempo, grava no sessionStorage e usa o fallback do Firestore (DataURL).
 */
export async function uploadImage({
  storeId,
  tipo,
  id,
  fileDataUrl,
}: UploadImageParams): Promise<UploadImageResult> {
  const startTime = performance.now();
  const fileId = id || `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const storagePath = `stores/${storeId}/${tipo}/${fileId}.webp`;

  // 2. MEMORIZAR O MÉTODO: Se o Storage já falhou anteriormente nesta sessão, pular direto
  const isStorageDisabled = sessionStorage.getItem(STORAGE_DISABLED_KEY) === 'true';

  if (isStorageDisabled) {
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[ImageService] MÉTÓDO USADO: Firestore DataURL (Pulpou Storage por registro em sessionStorage em ${elapsed}ms)`);
    return {
      url: fileDataUrl,
      method: 'firestore_dataurl',
      durationMs: elapsed,
    };
  }

  // 1. TIMEOUT NO STORAGE: Limite estrito de 6 segundos
  try {
    console.log(`[ImageService] Iniciando tentativa no Firebase Storage (timeout 6s): ${storagePath}`);
    const storageRef = ref(storage, storagePath);

    const uploadPromise = (async () => {
      await uploadString(storageRef, fileDataUrl, 'data_url', {
        contentType: 'image/webp',
        customMetadata: { storeId, tipo },
      });
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('TIMEOUT_STORAGE_6S'));
      }, 6000);
    });

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    const elapsed = Math.round(performance.now() - startTime);
    console.log(`[ImageService] MÉTÓDO USADO: Firebase Storage em ${elapsed}ms (URL: ${downloadUrl})`);

    return {
      url: downloadUrl,
      method: 'storage',
      storagePath,
      durationMs: elapsed,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - startTime);
    // Grava na sessão para não tentar o Storage novamente
    sessionStorage.setItem(STORAGE_DISABLED_KEY, 'true');

    console.warn(
      `[ImageService] MÉTÓDO USADO: Fallback automático DataURL no Firestore em ${elapsed}ms. (Motivo Storage: ${
        err?.message === 'TIMEOUT_STORAGE_6S' ? 'Timeout de 6s excedido' : err?.message || 'erro/permissão'
      })`
    );

    return {
      url: fileDataUrl,
      method: 'firestore_dataurl',
      durationMs: elapsed,
    };
  }
}

/**
 * Tenta apagar a imagem antiga do Firebase Storage com estrita segurança:
 * - Só apaga arquivos pertencentes à loja especificada no Storage.
 * - Nunca apaga imagens de demonstração, Unsplash ou recursos externos compartilhados.
 * - Falhas não bloqueiam nem comprometem o fluxo da aplicação.
 */
export async function deleteImage(imageUrl?: string | null, storeId?: string): Promise<void> {
  if (!imageUrl || typeof imageUrl !== 'string') return;

  // Ignorar dataURLs (Base64) ou caminhos locais
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) return;

  // Nunca tentar apagar Unsplash ou imagens de serviços de terceiros/compartilhados
  if (
    imageUrl.includes('images.unsplash.com') ||
    imageUrl.includes('unsplash.com') ||
    imageUrl.includes('wikimedia.org') ||
    imageUrl.includes('placeholder')
  ) {
    return;
  }

  // Verificar se é uma URL do Firebase Storage
  const isFirebaseStorageUrl =
    imageUrl.includes('firebasestorage.googleapis.com') ||
    imageUrl.includes('storage.googleapis.com');

  if (!isFirebaseStorageUrl) {
    return;
  }

  // Se o storeId for informado, validar que o caminho pertence estritamente a esta loja
  if (storeId) {
    const encodedStore = encodeURIComponent(`stores/${storeId}`);
    const rawStore = `stores/${storeId}`;
    if (!imageUrl.includes(encodedStore) && !imageUrl.includes(rawStore)) {
      console.warn(`[ImageService] Ignorando exclusão: a imagem não pertence à pasta da loja ${storeId}`);
      return;
    }
  }

  try {
    const storageRef = ref(storage, imageUrl);
    await deleteObject(storageRef);
    console.log(`[ImageService] Imagem antiga da loja removida do Firebase Storage: ${imageUrl}`);
  } catch (err) {
    console.warn(`[ImageService] Aviso: não foi possível apagar arquivo do Storage (não crítico):`, err);
  }
}
