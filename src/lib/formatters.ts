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

import { Store, DayHours, TimePeriod } from '../types';

export const DIAS_DA_SEMANA = [
  { dia: 1, nomeDia: 'Segunda-feira', nomeCurto: 'Seg' },
  { dia: 2, nomeDia: 'Terça-feira', nomeCurto: 'Ter' },
  { dia: 3, nomeDia: 'Quarta-feira', nomeCurto: 'Qua' },
  { dia: 4, nomeDia: 'Quinta-feira', nomeCurto: 'Qui' },
  { dia: 5, nomeDia: 'Sexta-feira', nomeCurto: 'Sex' },
  { dia: 6, nomeDia: 'Sábado', nomeCurto: 'Sáb' },
  { dia: 0, nomeDia: 'Domingo', nomeCurto: 'Dom' },
];

export function getDefaultHorarios(): DayHours[] {
  return DIAS_DA_SEMANA.map((d) => ({
    dia: d.dia,
    nomeDia: d.nomeDia,
    ativo: true,
    abertura: '10:00',
    fechamento: '22:00',
    periodos: [{ abertura: '10:00', fechamento: '22:00' }],
  }));
}

export function normalizeHorarios(horarios?: DayHours[]): DayHours[] {
  const defaults = getDefaultHorarios();
  if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
    return defaults;
  }

  return DIAS_DA_SEMANA.map((d) => {
    const existing = horarios.find((h) => h.dia === d.dia);
    if (!existing) {
      return {
        dia: d.dia,
        nomeDia: d.nomeDia,
        ativo: true,
        abertura: '10:00',
        fechamento: '22:00',
        periodos: [{ abertura: '10:00', fechamento: '22:00' }],
      };
    }

    let periodos: TimePeriod[] = [];
    if (Array.isArray(existing.periodos) && existing.periodos.length > 0) {
      periodos = existing.periodos.map((p) => ({
        abertura: p.abertura || '10:00',
        fechamento: p.fechamento || '22:00',
      }));
    } else {
      periodos = [
        {
          abertura: existing.abertura || '10:00',
          fechamento: existing.fechamento || '22:00',
        },
      ];
    }

    return {
      dia: existing.dia,
      nomeDia: existing.nomeDia || d.nomeDia,
      ativo: existing.ativo ?? true,
      abertura: periodos[0]?.abertura || '10:00',
      fechamento: periodos[0]?.fechamento || '22:00',
      periodos,
    };
  });
}

export function getManausNow(): Date {
  const now = new Date();
  try {
    const manausStr = now.toLocaleString('en-US', { timeZone: 'America/Manaus' });
    return new Date(manausStr);
  } catch (e) {
    return now;
  }
}

export function getNextOpeningText(horarios: DayHours[], now: Date = getManausNow()): string {
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let offset = 0; offset < 7; offset++) {
    const dayIndex = (currentDay + offset) % 7;
    const dayHours = horarios.find((h) => h.dia === dayIndex);

    if (!dayHours || !dayHours.ativo || !dayHours.periodos || dayHours.periodos.length === 0) {
      continue;
    }

    const sortedPeriods = [...dayHours.periodos].sort((a, b) => {
      const [hA, mA] = a.abertura.split(':').map(Number);
      const [hB, mB] = b.abertura.split(':').map(Number);
      return hA * 60 + mA - (hB * 60 + mB);
    });

    for (const p of sortedPeriods) {
      const [hA, mA] = p.abertura.split(':').map(Number);
      const minAb = hA * 60 + mA;

      if (offset === 0) {
        if (minAb > currentMinutes) {
          return `abre hoje às ${p.abertura}`;
        }
      } else if (offset === 1) {
        return `abre amanhã às ${p.abertura}`;
      } else {
        const dayInfo = DIAS_DA_SEMANA.find((d) => d.dia === dayIndex);
        const dayName = dayInfo ? dayInfo.nomeDia.toLowerCase() : 'em breve';
        return `abre ${dayName} às ${p.abertura}`;
      }
    }
  }

  return 'Sem horários cadastrados';
}

/**
 * Calcula se a loja está aberta respeitando:
 * 1. Status da loja (não pode estar bloqueada nem vencida)
 * 2. Botão manual "aberta" (se falso, loja fechada imediatamente)
 * 3. Horários configurados por dia da semana (fuso America/Manaus)
 */
export function isStoreOpen(store: Store): { isOpen: boolean; reason?: string } {
  if (store.status === 'bloqueada') {
    return { isOpen: false, reason: 'Loja temporariamente suspensa.' };
  }
  if (store.status === 'vencida') {
    return { isOpen: false, reason: 'Assinatura da loja indisponível no momento.' };
  }
  if (!store.aberta) {
    return { isOpen: false, reason: 'Fechada no momento (pausa manual do lojista).' };
  }

  const horarios = normalizeHorarios(store.horarios);
  const manausNow = getManausNow();
  const currentDay = manausNow.getDay(); // 0 = Dom, 1 = Seg ... 6 = Sáb
  const currentMinutes = manausNow.getHours() * 60 + manausNow.getMinutes();

  // 1. Checar horários do dia atual
  const todayHours = horarios.find((h) => h.dia === currentDay);
  if (todayHours && todayHours.ativo) {
    for (const p of todayHours.periodos || []) {
      const [hA, mA] = (p.abertura || '00:00').split(':').map(Number);
      const [hF, mF] = (p.fechamento || '23:59').split(':').map(Number);
      const minAb = hA * 60 + mA;
      const minFe = hF * 60 + mF;

      if (minFe > minAb) {
        if (currentMinutes >= minAb && currentMinutes <= minFe) {
          return { isOpen: true };
        }
      } else if (minFe < minAb) {
        // Virada da noite
        if (currentMinutes >= minAb) {
          return { isOpen: true };
        }
      } else {
        if (minAb === 0 && minFe === 1439) return { isOpen: true };
      }
    }
  }

  // 2. Checar horários que viraram a noite a partir de ONTEM
  const yesterdayDay = (currentDay + 6) % 7;
  const yesterdayHours = horarios.find((h) => h.dia === yesterdayDay);
  if (yesterdayHours && yesterdayHours.ativo) {
    for (const p of yesterdayHours.periodos || []) {
      const [hA, mA] = (p.abertura || '00:00').split(':').map(Number);
      const [hF, mF] = (p.fechamento || '23:59').split(':').map(Number);
      const minAb = hA * 60 + mA;
      const minFe = hF * 60 + mF;

      if (minFe < minAb) {
        if (currentMinutes <= minFe) {
          return { isOpen: true };
        }
      }
    }
  }

  const nextOpening = getNextOpeningText(horarios, manausNow);
  return {
    isOpen: false,
    reason: `Fechada no momento (${nextOpening}).`,
  };
}

export function getStoreCurrentStatusText(store: Store): string {
  if (store.status === 'bloqueada') return 'Agora: FECHADA (loja suspensa)';
  if (store.status === 'vencida') return 'Agora: FECHADA (assinatura vencida)';
  if (!store.aberta) return 'Agora: FECHADA (pausa manual ativada)';

  const openRes = isStoreOpen(store);
  if (openRes.isOpen) {
    return 'Agora: ABERTA';
  }

  const horarios = normalizeHorarios(store.horarios);
  const nextOpening = getNextOpeningText(horarios);
  return `Agora: FECHADA (${nextOpening})`;
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
