import QRCode from 'qrcode';

export function semAcento(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const removerAcentos = semAcento;

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export const calcularCrc16 = crc16;

export function normalizarChave(tipo: string, chave: string): string {
  const c = chave.trim();
  if (tipo === 'cpf' || tipo === 'cnpj') return c.replace(/\D/g, '');
  if (tipo === 'telefone') {
    const d = c.replace(/\D/g, '');
    return '+' + (d.startsWith('55') && d.length >= 12 ? d : '55' + d);
  }
  if (tipo === 'email') return c.toLowerCase();
  return c; // aleatoria: usar exatamente como cadastrada (UUID)
}

export function detectarTipoChave(chave: string): 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' {
  const c = chave.trim();
  if (!c) return 'aleatoria';
  if (c.includes('@')) return 'email';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'aleatoria';
  const digitos = c.replace(/\D/g, '');
  if (digitos.length === 14) return 'cnpj';
  if (c.startsWith('+') || (digitos.length >= 10 && digitos.length <= 13 && digitos.length !== 11)) return 'telefone';
  if (digitos.length === 11) {
    if (digitos.charAt(2) === '9') return 'telefone';
    return 'cpf';
  }
  return 'aleatoria';
}

export function gerarBrCode(params: {
  tipoChave?: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor?: number; // opcional: omitir para QR sem valor fixo
  txid: string;
}): string {
  const tipo = params.tipoChave || detectarTipoChave(params.chave);
  const chave = normalizarChave(tipo, params.chave);
  const nome = semAcento(params.nomeRecebedor).toUpperCase().slice(0, 25).trim() || 'LOJA';
  const cidade = semAcento(params.cidade).toUpperCase().slice(0, 15).trim() || 'BRASIL';
  const txid = String(params.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let payload =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', chave)) +
    tlv('52', '0000') +
    tlv('53', '986');

  if (params.valor && params.valor > 0) {
    payload += tlv('54', params.valor.toFixed(2));
  }

  payload +=
    tlv('58', 'BR') +
    tlv('59', nome) +
    tlv('60', cidade) +
    tlv('62', tlv('05', txid));

  payload += '6304'; // marcador do CRC, SEM o valor ainda
  return payload + crc16(payload);
}

export async function gerarQrCodeDataUrl(brCode: string): Promise<string> {
  try {
    return await QRCode.toDataURL(brCode, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
      color: {
        dark: '#171717',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Erro ao gerar imagem QR Code:', err);
    throw err;
  }
}

export function validarChavePix(chave: string, tipo?: string): { valida: boolean; erro?: string } {
  const limpo = chave.trim();
  if (!limpo) return { valida: false, erro: 'A chave Pix não pode estar vazia.' };
  const tipoEfetivo = tipo || detectarTipoChave(limpo);

  switch (tipoEfetivo) {
    case 'cpf': {
      const digitos = limpo.replace(/\D/g, '');
      if (digitos.length !== 11) return { valida: false, erro: 'CPF deve conter 11 dígitos numéricos.' };
      return { valida: true };
    }
    case 'cnpj': {
      const digitos = limpo.replace(/\D/g, '');
      if (digitos.length !== 14) return { valida: false, erro: 'CNPJ deve conter 14 dígitos numéricos.' };
      return { valida: true };
    }
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(limpo)) return { valida: false, erro: 'E-mail inválido.' };
      return { valida: true };
    }
    case 'telefone': {
      const digitos = limpo.replace(/\D/g, '');
      if (digitos.length < 10 || digitos.length > 13) {
        return { valida: false, erro: 'Telefone deve ter DDD + número (ex: 92994955835).' };
      }
      return { valida: true };
    }
    case 'aleatoria': {
      if (limpo.length < 28) {
        return { valida: false, erro: 'Chave aleatória inválida (formato EVP/UUID padrão).' };
      }
      return { valida: true };
    }
    default:
      return { valida: true };
  }
}
