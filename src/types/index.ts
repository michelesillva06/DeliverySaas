export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface TimePeriod {
  abertura: string; // "10:00"
  fechamento: string; // "22:00"
}

export interface DayHours {
  dia: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  nomeDia: string;
  ativo: boolean;
  abertura?: string; // Fallback / single period
  fechamento?: string; // Fallback / single period
  periodos?: TimePeriod[]; // Array of up to 3 periods
}

export interface StorePaymentMethods {
  pix: boolean;
  dinheiro: boolean;
  cartaoEntrega: boolean;
  whatsapp: boolean;
}

export interface StoreWhatsAppTemplates {
  aceito: string;
  preparo: string;
  saiuEntrega: string;
  prontoRetirada: string;
  cancelado: string;
}

export type StoreStatus = 'aguardando_ativacao' | 'ativa' | 'vencida' | 'bloqueada';

export interface StorePayment {
  id: string;
  storeId: string;
  storeNome?: string;
  tipo: 'implantacao' | 'mensalidade';
  valor: number;
  data: string; // YYYY-MM-DD ou ISO
  forma: 'pix' | 'cartao' | 'boleto' | 'transferencia' | 'dinheiro' | 'outro';
  observacao?: string;
  registradoPor?: string;
  registradoEm: string;
}

export interface Store {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  logo: string;
  capa: string;
  corPrimaria: string;
  whatsapp: string; // e.g. "5592999999999"
  endereco: string;
  nomeResponsavel?: string;
  emailResponsavel?: string;
  ownerUid: string;
  
  // Modelo de Negócio: Implantação + Mensalidade
  status: StoreStatus;
  plano: string; // e.g. "Iniciante", "Profissional", "Ilimitado", "Personalizado"
  valorImplantacao: number;
  valorMensalidade: number;
  diaVencimento: number; // e.g. 10
  dataVencimento: string; // ISO date string

  // Configurações Pix
  pixKey: string;
  pixKeyType: PixKeyType;
  pixReceiverName: string; // Max 25 chars, uppercase, no accents
  pixCity: string; // Max 15 chars, uppercase, no accents
  pixTestadoEm?: string; // ISO date string de quando a chave foi testada com R$ 1,00
  
  // Custom vanity URL
  customSlug?: string;
  
  // Formas de Pagamento
  pagamentos: StorePaymentMethods;
  
  // Horários e Operação
  horarios: DayHours[];
  aberta: boolean;
  pedidoMinimo: number;
  tempoEstimadoMin: number;
  tempoEstimadoRetiradaMin: number;
  aceitaEntrega: boolean;
  aceitaRetirada: boolean;
  
  // Impressão Térmica
  imprimirAutoAoAceitar?: boolean;
  larguraImpressora?: '80mm' | '58mm';
  viasImpressao?: 'cozinha' | 'entrega' | 'ambas';
  
  nextOrderNumber: number;
  mensagensWhatsapp: StoreWhatsAppTemplates;
  soIniciarAposConfirmarPix?: boolean;
  criadaEm?: string;
  criadoEm?: string;
  descontoGeral?: number;
  categorias?: any[];
  produtos?: any[];
  zonasEntrega?: any[];
  formasPagamento?: any;
  soundPreference?: 'chime' | 'bell' | 'alert';
}

export interface Category {
  id: string;
  storeId: string;
  nome: string;
  ordem: number;
  ativa: boolean;
}

export interface ProductOption {
  id: string;
  nome: string;
  descricao?: string;
  preco: number; // Additional price in BRL (0 for free)
  disponivel?: boolean;
  ativo?: boolean;
}

export type OptionItem = ProductOption;

export interface OptionGroup {
  id: string;
  storeId: string;
  nome: string; // e.g. "Escolha seu Pão", "Adicionais de Queijo", "Bebida Acompanhamento"
  obrigatorio: boolean;
  min: number; // 0 if optional
  max: number; // e.g. 1 for radio, 5 for checkboxes
  opcoes: ProductOption[];
}

export interface Product {
  id: string;
  storeId: string;
  categoryId?: string;
  categoriaId?: string;
  nome: string;
  descricao: string;
  preco: number; // Base price in BRL
  precoPromocional?: number;
  imagem?: string;
  foto?: string;
  destaque?: boolean;
  disponivel?: boolean;
  ativo?: boolean;
  ordem: number;
  optionGroupIds?: string[]; // IDs of OptionGroups applicable to this product
}

export interface DeliveryZone {
  id: string;
  storeId: string;
  bairro: string;
  taxa: number;
  tempoMin?: number;
  tempoExtra?: number;
  ativo: boolean;
}

export interface Coupon {
  id: string;
  storeId: string;
  codigo: string;
  tipo: 'percentual' | 'fixo' | 'porcentagem';
  valor: number; // percentage or fixed BRL
  minimo?: number;
  pedidoMinimo?: number;
  validade?: string; // YYYY-MM-DD
  limite?: number;
  maxUsos?: number;
  usados?: number;
  usos?: number;
  ativo: boolean;
}

export interface Courier {
  id: string;
  storeId: string;
  nome: string;
  telefone: string;
  taxaEntrega: number;
  ativo: boolean;
}

export interface Customer {
  id: string;
  storeId: string;
  nome: string;
  telefone: string;
  totalPedidos: number;
  totalGasto: number;
  ultimoPedidoEm: string;
}

export interface SelectedOption {
  grupoId: string;
  grupoNome: string;
  opcaoId: string;
  nome: string;
  preco: number;
  qtd?: number;
}

export interface OrderItem {
  id: string;
  produtoId: string;
  nome: string;
  qtd: number;
  precoUnit: number;
  complementos: SelectedOption[];
  obs?: string;
  totalItem: number;
}

export type OrderType = 'entrega' | 'retirada';
export type OrderStatus = 'novo' | 'aceito' | 'preparo' | 'pronto' | 'saiu_entrega' | 'entregue' | 'cancelado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao_entrega' | 'whatsapp';
export type PaymentStatus = 'aguardando' | 'informado' | 'confirmado' | 'na_entrega' | 'estornado';

export interface OrderHistoryItem {
  status: OrderStatus;
  em: string;
  nota?: string;
}

export interface Order {
  id: string;
  storeId: string;
  numero: number;
  customerUid: string;
  cliente: {
    nome: string;
    telefone: string;
  };
  tipo: OrderType;
  endereco?: {
    rua: string;
    numero: string;
    bairro: string;
    complemento?: string;
    referencia?: string;
  } | null;
  itens: OrderItem[];
  subtotal: number;
  desconto: number;
  cupom?: string | null;
  taxaEntrega: number;
  total: number;
  pagamento: {
    forma: PaymentMethod;
    status: PaymentStatus;
    troco?: number | null;
    trocoPara?: number | null;
    txid?: string;
  };
  status: OrderStatus;
  observacao?: string;
  observacoes?: string;
  motivoCancelamento?: string;
  entregadorId?: string;
  tempoEstimadoMin?: number;
  historicoStatus: OrderHistoryItem[];
  criadoEm: string;
  impressoAutomaticamenteEm?: string;
  teste?: boolean;
}

export type UserRole = 'master' | 'superadmin' | 'owner' | 'lojista';

export function isMasterRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'master' || normalized === 'superadmin';
}

export function isOwnerRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === 'owner' || normalized === 'lojista';
}

export interface UserProfile {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  storeId?: string;
  senha?: string;
  senhaTemporaria?: string;
  telefone?: string;
  ativo?: boolean; // padrão: true. Se false, o lojista não consegue logar
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface SaasPlanDetails {
  nome?: string;
  mensalidadePadrao?: number;
  implantacaoPadrao?: number;
  preco?: number;
  diasTrial?: number;
  maxProdutos?: number;
}

export interface SaasConfig {
  pixSuperAdmin: string;
  pixTipoChave?: string;
  nomeRecebedor?: string;
  cidade?: string;
  whatsappSuporte: string;
  whatsappVendas?: string;
  mensagemVendas?: string;
  precoPlanoStarter?: number;
  precoPlanoPro?: number;
  planos?: {
    iniciante: SaasPlanDetails;
    pro: SaasPlanDetails;
    ilimitado: SaasPlanDetails;
  };
}

export interface SubscriptionPaymentRequest {
  id: string;
  storeId: string;
  storeNome: string;
  valor: number;
  plano?: string;
  chavePix?: string;
  txid?: string;
  comprovanteNota?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
  analisadoEm?: string;
  analisadoPor?: string;
}

export type SaasPaymentRequest = SubscriptionPaymentRequest;
