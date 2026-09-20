import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  X,
  Check,
  RotateCcw,
  ZoomIn,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Crop,
  RefreshCw,
} from 'lucide-react';
import {
  validateImageFile,
  downscaleImageFile,
  cropAndCompressImage,
  CROP_CONFIGS,
} from '../lib/imageProcessor';
import { uploadImage, deleteImage } from '../services/imageService';
import { updateProductPhotoInFirestore } from '../services/firestoreService';
import { useToast } from './Toast';

export interface ImageUploaderProps {
  tipo: 'logo' | 'capa' | 'produto' | 'categoria';
  currentImageUrl?: string;
  storeId: string;
  entityId?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  label?: string;
  aspectRatioLabel?: string;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  tipo,
  currentImageUrl,
  storeId,
  entityId,
  onImageUploaded,
  onImageRemoved,
  label,
  aspectRatioLabel,
  className = '',
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Indicadores de Etapa Real com Tempo
  const [uploadStage, setUploadStage] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const abortControllerRef = useRef<boolean>(false);

  // Estados do Modal de Recorte
  const [showCropModal, setShowCropModal] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const config = CROP_CONFIGS[tipo];

  // Limpeza de timer ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    setErrorMessage('');
    setSelectedFile(file);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Arquivo inválido.');
      showToast(validation.error || 'Arquivo inválido.', 'error');
      return;
    }

    try {
      setUploadStage('Lendo imagem...');
      // 3. REDUZIR ANTES DE TUDO: Redimensionar imagem original para max 1600px no maior lado com createImageBitmap + canvas
      const { dataUrl, durationMs, width, height } = await downscaleImageFile(file, 1600);
      console.log(`[Upload Stage] Lendo imagem: ${durationMs} ms (Dimensão: ${width}x${height})`);

      setRawImageSrc(dataUrl);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setShowCropModal(true);
    } catch (err: any) {
      console.error('[ImageUploader] Erro ao ler/reduzir arquivo:', err);
      setErrorMessage('Não foi possível ler o arquivo de imagem.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // Controles de Arrastar (Pan) no Modal de Recorte
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setOffset({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Controles Touch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      const touch = e.touches[0];
      setStartPan({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPanning || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setOffset({
      x: touch.clientX - startPan.x,
      y: touch.clientY - startPan.y,
    });
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCancelProcess = () => {
    abortControllerRef.current = true;
    stopTimer();
    setUploading(false);
    setUploadStage('');
    showToast('Envio cancelado pelo usuário.', 'info');
  };

  // Executar Recorte e Upload com Etapas Reais, Timer e Safety Timeout de 15s
  const handleConfirmCrop = async () => {
    if (!imageRef.current || !viewportRef.current) return;

    abortControllerRef.current = false;
    setUploading(true);
    setErrorMessage('');
    setElapsedSeconds(0);

    const totalStartTime = performance.now();

    // Iniciar contador de tempo na UI
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = Math.round((prev + 0.2) * 10) / 10;
        // 5. SAFETY TIMEOUT: Se passar de 15 segundos no total, mostrar erro claro
        if (next >= 15) {
          abortControllerRef.current = true;
          stopTimer();
          setUploading(false);
          setErrorMessage('Tempo limite excedido (15s). Não foi possível concluir o envio.');
          showToast('Tempo limite excedido (15s). Tente novamente.', 'error');
        }
        return next;
      });
    }, 200);

    try {
      // ETAPA 1: RECORTE
      setUploadStage('Recortando…');
      const cropStartTime = performance.now();

      const img = imageRef.current;
      const viewport = viewportRef.current;

      const viewportRect = viewport.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      const scaleX = img.naturalWidth / imgRect.width;
      const scaleY = img.naturalHeight / imgRect.height;

      const cropX = Math.max(0, (viewportRect.left - imgRect.left) * scaleX);
      const cropY = Math.max(0, (viewportRect.top - imgRect.top) * scaleY);
      const cropWidth = Math.min(img.naturalWidth - cropX, viewportRect.width * scaleX);
      const cropHeight = Math.min(img.naturalHeight - cropY, viewportRect.height * scaleY);

      const cropDuration = Math.round(performance.now() - cropStartTime);
      console.log(`[Upload Stage] Recortando: ${cropDuration} ms`);

      if (abortControllerRef.current) return;

      // ETAPA 2: COMPRESSÃO
      setUploadStage('Comprimindo…');
      const { dataUrl: compressedDataUrl, durationMs: compressDuration, finalKb } =
        await cropAndCompressImage(
          img,
          { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
          tipo
        );

      console.log(`[Upload Stage] Comprimindo: ${compressDuration} ms (${finalKb} KB)`);

      if (abortControllerRef.current) return;

      // ETAPA 3: SALVANDO
      setUploadStage('Salvando…');
      const saveStartTime = performance.now();

      const result = await uploadImage({
        storeId,
        tipo,
        id: entityId,
        fileDataUrl: compressedDataUrl,
      });

      const saveDuration = Math.round(performance.now() - saveStartTime);
      console.log(
        `[Upload Stage] Salvando: ${saveDuration} ms (Método usado: ${result.method})`
      );

      if (abortControllerRef.current) return;

      // Gravação pontual do produto no Firestore se for um produto existente
      if (tipo === 'produto' && entityId) {
        await updateProductPhotoInFirestore(entityId, result.url);
      }

      const totalDuration = Math.round(performance.now() - totalStartTime);
      console.log(
        `[Upload Total] Tempo total de processamento e envio da foto: ${totalDuration} ms`
      );

      // Apagar imagem antiga se houver
      if (currentImageUrl && currentImageUrl !== result.url) {
        deleteImage(currentImageUrl).catch(console.warn);
      }

      stopTimer();
      onImageUploaded(result.url);
      setShowCropModal(false);
      setRawImageSrc(null);

      if (result.method === 'storage') {
        showToast(`Imagem salva no Storage (${(totalDuration / 1000).toFixed(1)}s)!`, 'success');
      } else {
        showToast(`Imagem otimizada e salva (${(totalDuration / 1000).toFixed(1)}s)!`, 'success');
      }
    } catch (err: any) {
      stopTimer();
      console.error('[ImageUploader] Erro ao processar/enviar imagem:', err);
      const msg = err?.code ? `[${err.code}] ${err.message}` : err?.message || 'Falha de conexão ou envio de imagem.';
      setErrorMessage(msg);
      showToast(`Erro ao enviar foto: ${msg}`, 'error');
    } finally {
      stopTimer();
      setUploading(false);
      setUploadStage('');
    }
  };

  const handleRemove = async () => {
    if (!currentImageUrl) return;
    if (!window.confirm('Tem certeza que deseja remover esta foto?')) return;

    setUploading(true);
    try {
      await deleteImage(currentImageUrl);
      if (tipo === 'produto' && entityId) {
        await updateProductPhotoInFirestore(entityId, null);
      }
      if (onImageRemoved) onImageRemoved();
      showToast('Foto removida com sucesso.', 'info');
    } catch (e: any) {
      console.error('[ImageUploader] Erro ao remover imagem:', e);
      const msg = e?.code ? `[${e.code}] ${e.message}` : e?.message || 'Erro ao remover imagem.';
      showToast(`Erro ao remover foto: ${msg}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const isCover = tipo === 'capa';
  const aspectClass = isCover ? 'aspect-[3/1]' : 'aspect-square';

  return (
    <div className={`space-y-2 ${className}`}>
      {(label || aspectRatioLabel) && (
        <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
          <span>{label || (isCover ? 'Capa da Loja' : 'Imagem')}</span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {aspectRatioLabel || (isCover ? 'Proporção 3:1' : 'Proporção 1:1')}
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />

      {currentImageUrl ? (
        <div className={`relative rounded-2xl overflow-hidden border border-neutral-200 group bg-neutral-100 ${aspectClass}`}>
          <img
            src={currentImageUrl}
            alt={label || 'Imagem'}
            className="w-full h-full object-cover"
          />

          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 bg-white hover:bg-neutral-100 text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Trocar</span>
            </button>

            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remover</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center p-4 text-center ${aspectClass} ${
            isDragging
              ? 'border-rose-500 bg-rose-50/50 scale-[1.01]'
              : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50 hover:bg-neutral-100/80'
          }`}
        >
          <div className="w-10 h-10 rounded-2xl bg-white border border-neutral-200 shadow-xs flex items-center justify-center text-neutral-500 mb-2">
            <ImageIcon className="w-5 h-5 text-neutral-600" />
          </div>

          <p className="text-xs font-bold text-neutral-800">
            Arraste ou clique para selecionar
          </p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            JPG, PNG ou WebP (máx. 10 MB)
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[11px] font-bold shadow-xs cursor-pointer"
            >
              Escolher Foto
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cameraInputRef.current?.click();
              }}
              className="px-3 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-xl text-[11px] font-bold shadow-xs flex items-center gap-1 cursor-pointer sm:hidden"
            >
              <Camera className="w-3.5 h-3.5 text-neutral-600" />
              <span>Câmera</span>
            </button>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
          <div className="text-xs text-rose-700 flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              if (selectedFile) handleFileSelect(selectedFile);
              else fileInputRef.current?.click();
            }}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar de novo</span>
          </button>
        </div>
      )}

      {showCropModal && rawImageSrc && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-5 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Crop className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-sm text-white">
                  Ajuste e Enquadre a Imagem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (uploading) handleCancelProcess();
                  setShowCropModal(false);
                  setRawImageSrc(null);
                }}
                className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Arraste a imagem para enquadrar no centro e use a barra abaixo para dar zoom.
            </p>

            <div
              ref={viewportRef}
              className={`relative overflow-hidden rounded-2xl bg-black border-2 border-dashed border-rose-500/80 cursor-grab active:cursor-grabbing select-none mx-auto ${
                isCover ? 'w-full aspect-[3/1]' : 'w-64 h-64 sm:w-72 sm:h-72 aspect-square'
              }`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <img
                  ref={imageRef}
                  src={rawImageSrc}
                  alt="Recorte"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    pointerEvents: 'none',
                  }}
                  className="transition-transform duration-75"
                />
              </div>

              <div className="absolute inset-0 border border-white/20 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-r border-b border-white/10" />
                <div className="border-b border-white/10" />
                <div className="border-r border-white/10" />
                <div className="border-r border-white/10" />
                <div />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-bold">
                <span className="flex items-center gap-1">
                  <ZoomIn className="w-3.5 h-3.5 text-rose-400" />
                  <span>Zoom ({Math.round(zoom * 100)}%)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setOffset({ x: 0, y: 0 });
                  }}
                  className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resetar</span>
                </button>
              </div>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
              />
            </div>

            {uploading && (
              <div className="p-3 bg-neutral-800 border border-neutral-700 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    <span>{uploadStage || 'Processando…'}</span>
                  </span>
                  <span className="font-mono text-neutral-300">{elapsedSeconds.toFixed(1)}s</span>
                </div>
                <div className="w-full bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full transition-all duration-200"
                    style={{ width: `${Math.min(100, (elapsedSeconds / 15) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (uploading) handleCancelProcess();
                  else {
                    setShowCropModal(false);
                    setRawImageSrc(null);
                  }
                }}
                className="w-1/3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {uploading ? 'Cancelar' : 'Fechar'}
              </button>

              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={uploading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadStage || 'Processando…'} ({elapsedSeconds.toFixed(1)}s)</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar e Salvar Foto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
