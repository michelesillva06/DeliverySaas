import { Store } from '../types';

/**
 * Formata um número para Moeda Real (BRL)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Formata um número de telefone com máscara BR
 */
export function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone;
}

/**
 * Limpa o telefone para conter apenas dígitos e garantir DDI 55
 */
export function sanitizePhone(phone: string): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits;
}

/**
 * Formata data e hora no padrão pt-BR
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Formata apenas hora no padrão pt-BR
 */
export function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calcula se a loja está aberta respeitando:
 * 1. Status da loja (não pode estar bloqueada nem vencida)
 * 2. Botão manual "aberta" (se falso, loja fechada imediatamente)
 * 3. Horários configurados por dia da semana
 */
export function isStoreOpen(store: Store): { isOpen: boolean; reason?: string } {
  if (store.status === 'bloqueada') {
    return { isOpen: false, reason: 'Loja temporariamente suspensa.' };
  }
  if (store.status === 'vencida') {
    return { isOpen: false, reason: 'Assinatura da loja indisponível no momento.' };
  }
  if (!store.aberta) {
    return { isOpen: false, reason: 'Fechada no momento (pausa do lojista).' };
  }

  // Verificar horários semanais
  if (!store.horarios || store.horarios.length === 0) {
    return { isOpen: true }; // Sem horários fixos, segue a chave manual
  }

  // Obter dia da semana atual e hora atual (fuso configurável / local)
  const now = new Date();
  const diaSemana = now.getDay(); // 0 = Domingo, 1 = Segunda...
  const horarioHoje = store.horarios.find((h) => h.dia === diaSemana);

  if (!horarioHoje || !horarioHoje.ativo) {
    return { isOpen: false, reason: 'Fechada hoje de acordo com os horários de funcionamento.' };
  }

  // Checar faixa de horário (formato "HH:mm")
  const horaAtual = now.getHours() * 60 + now.getMinutes();
  const [horaAb, minAb] = (horarioHoje.abertura || '00:00').split(':').map(Number);
  const [horaFe, minFe] = (horarioHoje.fechamento || '23:59').split(':').map(Number);
  
  const minutosAbertura = horaAb * 60 + minAb;
  const minutosFechamento = horaFe * 60 + minFe;

  // Lidar com horários que viram a noite (ex: 18:00 até 02:00)
  if (minutosFechamento < minutosAbertura) {
    if (horaAtual >= minutosAbertura || horaAtual <= minutosFechamento) {
      return { isOpen: true };
    }
  } else {
    if (horaAtual >= minutosAbertura && horaAtual <= minutosFechamento) {
      return { isOpen: true };
    }
  }

  return {
    isOpen: false,
    reason: `Fechada no momento. Horário hoje: ${horarioHoje.abertura} às ${horarioHoje.fechamento}`,
  };
}

/**
 * Cria o link direto para WhatsApp com número e mensagem pré-preenchida
 */
export function generateWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = sanitizePhone(phone);
  const encodedText = encodeURIComponent(text.trim());
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Comprime uma imagem no cliente para no máximo 200KB e largura máxima de 800px
 */
export async function compressImage(file: File, maxWidth = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(img.src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
