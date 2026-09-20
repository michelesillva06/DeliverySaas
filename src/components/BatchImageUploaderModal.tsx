import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  FileImage,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { Product } from '../types';
import {
  validateImageFile,
  downscaleImageFile,
  cropAndCompressImage,
  normalizeStringForMatching,
  getDataUrlByteSize,
} from '../lib/imageProcessor';
import { uploadImage } from '../services/imageService';
import { updateProductPhotoInFirestore } from '../services/firestoreService';
import { useToast } from './Toast';

export interface BatchItem {
  id: string;
  file: File;
  previewUrl: string;
  fileName: string;
  selectedProductId: string;
  autoMatched: boolean;
  status: 'pending' | 'processing' | 'saved' | 'error';
  errorMessage?: string;
  savedUrl?: string;
}

export interface BatchImageUploaderModalProps {
  storeId: string;
  products: Product[];
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchImageUploaderModal: React.FC<BatchImageUploaderModalProps> = ({
  storeId,
  products,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const findBestProductMatch = (fileName: string): { productId: string; autoMatched: boolean } => {
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    const cleanFileName = normalizeStringForMatching(nameWithoutExt);

    if (!cleanFileName) return { productId: '', autoMatched: false };

    // Correspondência exata
    for (const p of products) {
      const cleanProdName = normalizeStringForMatching(p.nome);
      if (cleanProdName && cleanProdName === cleanFileName) {
        return { productId: p.id, autoMatched: true };
      }
    }

    // Correspondência parcial
    for (const p of products) {
      const cleanProdName = normalizeStringForMatching(p.nome);
      if (
        cleanProdName &&
        cleanFileName.length >= 3 &&
        (cleanFileName.includes(cleanProdName) || cleanProdName.includes(cleanFileName))
      ) {
        return { productId: p.id, autoMatched: true };
      }
    }

    return { productId: '', autoMatched: false };
  };

  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newItems: BatchItem[] = [];

    fileArray.forEach((file) => {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        showToast(`Arquivo "${file.name}" ignorado: ${validation.error}`, 'error');
        return;
      }

      const match = findBestProductMatch(file.name);
      const previewUrl = URL.createObjectURL(file);

      newItems.push({
        id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl,
        fileName: file.name,
        selectedProductId: match.productId,
        autoMatched: match.autoMatched,
        status: 'pending',
      });
    });

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      showToast(`${newItems.length} foto(s) adicionada(s) para conferência.`, 'info');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
    e.target.value = '';
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProductSelectChange = (itemId: string, productId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, selectedProductId: productId, autoMatched: false, status: 'pending', errorMessage: undefined }
          : item
      )
    );
  };

  // Helper para processar um único item individualmente
  const processSingleItemInternal = async (item: BatchItem): Promise<boolean> => {
    try {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'processing', errorMessage: undefined } : i))
      );

      // 1. Reduzir imagem para no máximo 800px no maior lado
      const { dataUrl: downscaledDataUrl } = await downscaleImageFile(item.file, 800);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao carregar a imagem para processamento.'));
        img.src = downscaledDataUrl;
      });

      // Calcular enquadramento centralizado 1:1
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      const cropX = (img.naturalWidth - minDim) / 2;
      const cropY = (img.naturalHeight - minDim) / 2;

      // 2. Comprimir em WebP (máximo 800px e 120 KB)
      const { dataUrl: compressedDataUrl, finalKb } = await cropAndCompressImage(
        img,
        { x: cropX, y: cropY, width: minDim, height: minDim },
        'produto'
      );

      // Validar limite do documento do Firestore (<= 900 KB)
      const byteSize = getDataUrlByteSize(compressedDataUrl);
      if (byteSize > 900 * 1024) {
        throw new Error(`Imagem excede o limite de 900 KB (${Math.round(byteSize / 1024)} KB).`);
      }

      // 3. Enviar para Storage ou DataURL fallback
      const uploadRes = await uploadImage({
        storeId,
        tipo: 'produto',
        id: item.selectedProductId,
        fileDataUrl: compressedDataUrl,
      });

      // 4. Gravação PONTUAL no Firestore (substitui foto anterior)
      await updateProductPhotoInFirestore(item.selectedProductId, uploadRes.url);

      console.log(
        `[BatchUploader] Foto "${item.fileName}" salva para produto ${item.selectedProductId} (${finalKb} KB, método: ${uploadRes.method})`
      );

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'saved', savedUrl: uploadRes.url } : i
        )
      );

      return true;
    } catch (err: any) {
      console.error(`[BatchUploader] Erro ao enviar foto do arquivo ${item.fileName}:`, err);

      let msg = 'Erro desconhecido ao salvar foto.';
      if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        msg = 'Sem permissão no Firestore para atualizar este produto.';
      } else if (err?.message?.includes('900 KB')) {
        msg = err.message;
      } else {
        msg = err?.code ? `[${err.code}] ${err.message}` : err?.message || 'Falha ao salvar no Firestore.';
      }

      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'error', errorMessage: msg } : i))
      );

      showToast(`Falha em "${item.fileName}": ${msg}`, 'error');
      return false;
    }
  };

  // Processamento em lote SEQUENCIAL (for ... of com await)
  const handleConfirmBatchUpload = async () => {
    const queue = items.filter((item) => item.selectedProductId && item.status !== 'saved');

    if (queue.length === 0) {
      showToast('Selecione os produtos correspondentes para enviar.', 'error');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const item of queue) {
      const ok = await processSingleItemInternal(item);
      if (ok) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    setUploading(false);

    showToast(
      `Envio concluído: ${successCount} foto(s) salva(s)${errorCount > 0 ? `, ${errorCount} com erro.` : '.'}`,
      errorCount > 0 ? 'error' : 'success'
    );

    if (errorCount === 0) {
      onSuccess();
      onClose();
    }
  };

  // Tentar de novo um único item que apresentou erro
  const handleRetrySingle = async (item: BatchItem) => {
    if (!item.selectedProductId || uploading) return;
    setUploading(true);
    const ok = await processSingleItemInternal(item);
    setUploading(false);
    if (ok) {
      showToast(`Foto "${item.fileName}" salva com sucesso!`, 'success');
    }
  };

  const pendingOrErrorCount = items.filter((i) => i.selectedProductId && i.status !== 'saved').length;
  const savedCount = items.filter((i) => i.status === 'saved').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-neutral-900">
                Envio em Lote de Fotos dos Produtos
              </h2>
              <p className="text-xs text-neutral-500">
                Processamento sequencial de fotos (WebP, max 800px). Se o produto já possui foto, ela será substituída.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {items.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 hover:border-rose-500 rounded-2xl p-10 text-center cursor-pointer bg-neutral-50 hover:bg-rose-50/40 transition-all space-y-3"
            >
              <div className="w-14 h-14 rounded-3xl bg-white border border-neutral-200 shadow-xs flex items-center justify-center mx-auto text-rose-600">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-800">
                  Clique aqui para selecionar várias imagens de produtos
                </h3>
                <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                  Dica: nomeie seus arquivos com o nome dos produtos (ex.: <code className="bg-neutral-200 px-1 py-0.5 rounded text-neutral-700 font-mono">x-tudo.png</code>) para que o sistema reconheça sozinho!
                </p>
              </div>
              <button
                type="button"
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <FileImage className="w-4 h-4" />
                <span>Selecionar Arquivos do Computador</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-neutral-700">
                    {items.length} foto(s) carregada(s)
                  </span>
                  {savedCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      {savedCount} salva(s)
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                      {errorCount} com erro
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Adicionar Mais Fotos</span>
                </button>
              </div>

              {/* Tabela de Conferência e Progresso */}
              <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-600 font-bold uppercase tracking-wider border-b border-neutral-200">
                      <tr>
                        <th className="p-3">Foto</th>
                        <th className="p-3">Nome do Arquivo</th>
                        <th className="p-3">Produto Correspondente</th>
                        <th className="p-3 text-center">Ação</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Opções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium">
                      {items.map((item) => {
                        const targetProd = products.find((p) => p.id === item.selectedProductId);
                        const hasExistingPhoto = Boolean(targetProd?.foto);

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/80 transition-colors">
                            {/* Preview */}
                            <td className="p-2.5">
                              <img
                                src={item.savedUrl || item.previewUrl}
                                alt={item.fileName}
                                className="w-12 h-12 object-cover rounded-xl border border-neutral-200 bg-neutral-100"
                              />
                            </td>

                            {/* Nome do Arquivo */}
                            <td
                              className="p-2.5 max-w-[160px] truncate font-mono text-[11px] text-neutral-700"
                              title={item.fileName}
                            >
                              {item.fileName}
                            </td>

                            {/* Produto Correspondente */}
                            <td className="p-2.5 min-w-[200px]">
                              <select
                                value={item.selectedProductId}
                                onChange={(e) => handleProductSelectChange(item.id, e.target.value)}
                                disabled={uploading || item.status === 'saved'}
                                className="w-full p-2 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-bold text-neutral-900 focus:outline-none focus:border-rose-500 disabled:opacity-60"
                              >
                                <option value="">-- Selecionar Produto --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nome} {p.foto ? '(Já possui foto)' : ''}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Ação: Substituir ou Adicionar */}
                            <td className="p-2.5 text-center">
                              {targetProd ? (
                                hasExistingPhoto ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900">
                                    <span>Substituir</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                                    <span>Adicionar</span>
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500">
                                  <span>Pendente</span>
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-2.5 text-center">
                              {item.status === 'processing' && (
                                <span className="inline-flex items-center gap-1.5 text-rose-600 font-bold text-[11px] animate-pulse">
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Processando...</span>
                                </span>
                              )}

                              {item.status === 'saved' && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  <span>Salvo</span>
                                </span>
                              )}

                              {item.status === 'error' && (
                                <div className="flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-[11px]">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Erro</span>
                                  </span>
                                  <span
                                    className="text-[10px] text-rose-500 max-w-[150px] truncate"
                                    title={item.errorMessage}
                                  >
                                    {item.errorMessage}
                                  </span>
                                </div>
                              )}

                              {item.status === 'pending' && (
                                <span className="text-neutral-400 text-[11px]">Aguardando</span>
                              )}
                            </td>

                            {/* Opções */}
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {item.status === 'error' && !uploading && (
                                  <button
                                    type="button"
                                    onClick={() => handleRetrySingle(item)}
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    title="Tentar de novo este item"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Tentar de novo</span>
                                  </button>
                                )}

                                {item.status !== 'saved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    disabled={uploading}
                                    className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
                                    title="Remover do lote"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {savedCount > 0 ? 'Concluir' : 'Cancelar'}
          </button>

          <button
            type="button"
            onClick={handleConfirmBatchUpload}
            disabled={uploading || pendingOrErrorCount === 0}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando fotos...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar e Enviar {pendingOrErrorCount} Foto(s)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
