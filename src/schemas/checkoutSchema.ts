import { z } from 'zod';

/**
 * Schema Zod para validação e sanitização do formulário de Checkout.
 * Garante que campos opcionais (complemento, referencia, etc.)
 * sejam transformados em strings vazias "" ou tratados adequadamente,
 * eliminando a possibilidade de envio de valores `undefined` para o Firebase.
 */
export const checkoutFormSchema = z
  .object({
    nome: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim())
      .refine((val) => val.length >= 2, {
        message: 'Por favor, informe seu nome (mínimo de 2 caracteres).',
      }),

    telefone: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').replace(/\D/g, ''))
      .refine((val) => val.length >= 10, {
        message: 'Por favor, informe um telefone válido com DDD (ex: 92999999999).',
      }),

    orderType: z.enum(['entrega', 'retirada']),

    rua: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    numero: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    complemento: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    referencia: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    bairro: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    paymentMethod: z.enum(['pix', 'cartao_entrega', 'dinheiro', 'whatsapp']),

    trocoPara: z
      .string()
      .nullish()
      .transform((val) => (val ?? '').trim()),

    total: z.number().default(0),

    lgpdConsent: z.boolean().refine((val) => val === true, {
      message: 'É necessário aceitar os termos de consentimento para continuar.',
    }),
  })
  .superRefine((data, ctx) => {
    if (data.orderType === 'entrega') {
      if (!data.rua) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rua'],
          message: 'Preencha a rua para entrega.',
        });
      }
      if (!data.numero) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['numero'],
          message: 'Preencha o número do endereço.',
        });
      }
      if (!data.bairro) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bairro'],
          message: 'Selecione seu bairro para calcular a entrega.',
        });
      }
    }

    if (data.paymentMethod === 'dinheiro' && data.trocoPara) {
      const parsed = parseFloat(data.trocoPara.replace(',', '.'));
      if (isNaN(parsed) || parsed < data.total) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['trocoPara'],
          message: `O valor para troco deve ser maior ou igual ao total do pedido.`,
        });
      }
    }
  });

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>;

export interface CleanedAddress {
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  referencia: string;
}

export function validateAndSanitizeCheckout(rawInput: unknown): {
  success: true;
  data: {
    nome: string;
    telefone: string;
    orderType: 'entrega' | 'retirada';
    endereco: CleanedAddress | null;
    paymentMethod: 'pix' | 'cartao_entrega' | 'dinheiro' | 'whatsapp';
    parsedTroco: number | null;
  };
} | {
  success: false;
  error: string;
} {
  const result = checkoutFormSchema.safeParse(rawInput);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message || 'Dados do formulário inválidos.',
    };
  }

  const valid = result.data;

  // Montagem do endereço garantido sem nenhum undefined
  let endereco: CleanedAddress | null = null;
  if (valid.orderType === 'entrega') {
    endereco = {
      rua: valid.rua,
      numero: valid.numero,
      bairro: valid.bairro,
      complemento: valid.complemento, // Sempre string ex: "" ou "Apt 101"
      referencia: valid.referencia,   // Sempre string ex: "" ou "Próximo à praça"
    };
  }

  // Troco sanitizado
  let parsedTroco: number | null = null;
  if (valid.paymentMethod === 'dinheiro' && valid.trocoPara) {
    const val = parseFloat(valid.trocoPara.replace(',', '.'));
    if (!isNaN(val)) {
      parsedTroco = val;
    }
  }

  return {
    success: true,
    data: {
      nome: valid.nome,
      telefone: valid.telefone,
      orderType: valid.orderType,
      endereco,
      paymentMethod: valid.paymentMethod,
      parsedTroco,
    },
  };
}
