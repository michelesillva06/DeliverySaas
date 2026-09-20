export const SUPPORT_WHATSAPP = "5592994955835";
export const SUPPORT_MESSAGE_NEW_STORE = "Olá! Quero criar a minha loja no Pede AI. Pode me passar mais informações?";
export const SUPPORT_MESSAGE_HELP = "Olá! Preciso de suporte com a plataforma Pede AI.";

export const getWhatsAppSupportLink = (
  phone: string = SUPPORT_WHATSAPP,
  message: string = SUPPORT_MESSAGE_NEW_STORE
) => {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : SUPPORT_WHATSAPP;
  const finalPhone = cleanPhone || SUPPORT_WHATSAPP;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
};
