import QRCode from 'qrcode';

export interface PixPayloadParams {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor: number;
  txid?: string;
  descricao?: string;
}

/**
 * Remove acentos e caracteres especiais para compatibilidade com o padrão EMV
 */
export function removerAcentos(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
}

/**
 * Formata um campo no padrão EMV: ID(2 dígitos) + TAMANHO(2 dígitos) + VALOR
 */
function formatarCampoEmv(id: string, valor: string): string {
  const tamanho = valor.length.toString().padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

/**
 * Calcula o CRC16-CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF)
 */
export function calcularCrc16(payload: string): string {
  let crc = 0xffff;
  const polinomio = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ polinomio;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff; // Manter 16 bits
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera a string Pix Copia e Cola (BR Code) oficial do Banco Central
 */
export function gerarBrCode(params: PixPayloadParams): string {
  const chave = params.chave.trim();
  const nome = removerAcentos(params.nomeRecebedor).toUpperCase().slice(0, 25) || 'RECEBEDOR';
  const cidade = removerAcentos(params.cidade).toUpperCase().slice(0, 15) || 'BRASIL';
  const valorFormatado = params.valor.toFixed(2);
  
  // Sanitizar TXID: apenas letras e números, máx 25 chars. Se vazio, usar "***"
  let txid = (params.txid || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  if (!txid) txid = '***';

  // 00: Payload Format Indicator
  let payload = formatarCampoEmv('00', '01');

  // 01: Point of Initiation Method (11 = QR estático/reutilizável, 12 = dinâmico)
  payload += formatarCampoEmv('01', '11');

  // 26: Merchant Account Information - GUI + Chave + Descrição
  let subcampo26 = formatarCampoEmv('00', 'br.gov.bcb.pix');
  subcampo26 += formatarCampoEmv('01', chave);
  if (params.descricao) {
    const desc = removerAcentos(params.descricao).slice(0, 40);
    if (desc) {
      subcampo26 += formatarCampoEmv('02', desc);
    }
  }
  payload += formatarCampoEmv('26', subcampo26);

  // 52: Merchant Category Code
  payload += formatarCampoEmv('52', '0000');

  // 53: Transaction Currency (986 = Real Brasileiro)
  payload += formatarCampoEmv('53', '986');

  // 54: Transaction Amount
  payload += formatarCampoEmv('54', valorFormatado);

  // 58: Country Code
  payload += formatarCampoEmv('58', 'BR');

  // 59: Merchant Name
  payload += formatarCampoEmv('59', nome);

  // 60: Merchant City
  payload += formatarCampoEmv('60', cidade);

  // 62: Additional Data Field Template (TXID)
  const subcampo62 = formatarCampoEmv('05', txid);
  payload += formatarCampoEmv('62', subcampo62);

  // 63: CRC16 (Adiciona o cabeçalho '6304' antes do cálculo)
  const payloadComCabecalhoCrc = payload + '6304';
  const crc = calcularCrc16(payloadComCabecalhoCrc);

  return payloadComCabecalhoCrc + crc;
}

/**
 * Gera a imagem Base64 do QR Code a partir do código Pix
 */
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

/**
 * Validação de chave Pix de acordo com o tipo
 */
export function validarChavePix(chave: string, tipo: string): { valida: boolean; erro?: string } {
  const limpo = chave.trim();
  if (!limpo) return { valida: false, erro: 'A chave Pix não pode estar vazia.' };

  switch (tipo) {
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
        return { valida: false, erro: 'Telefone deve ter DDD + número (ex: 5592999999999).' };
      }
      return { valida: true };
    }
    case 'aleatoria': {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(limpo) && limpo.length < 32) {
        return { valida: false, erro: 'Chave aleatória inválida (formato padrão 32-36 caracteres).' };
      }
      return { valida: true };
    }
    default:
      return { valida: true };
  }
}
