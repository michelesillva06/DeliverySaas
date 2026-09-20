/**
 * Utilitário para limpar recursivamente propriedades com valor undefined em objetos e arrays,
 * preservando estritamente null, 0, false, "" e instâncias de Date ou FieldValue do Firestore.
 */
export function limparObjeto<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  // Preservar instâncias de Date
  if (obj instanceof Date) {
    return obj;
  }

  // Preservar sentinelas FieldValue do Firestore (ex: deleteField(), serverTimestamp())
  if (
    '_methodName' in (obj as any) ||
    (obj as any).constructor?.name === 'FieldValue' ||
    (obj as any).constructor?.name === 'DeleteFieldValue' ||
    (obj as any).constructor?.name === 'ServerTimestampFieldValue'
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return (obj as any[])
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? limparObjeto(item) : item)) as unknown as T;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null) {
        result[key] = limparObjeto(value);
      } else {
        result[key] = value;
      }
    }
  }

  return result as T;
}

export const cleanUndefined = limparObjeto;
