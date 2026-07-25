export function gerarLinkWhatsApp(telefone: string, contexto: string): string {
  const numero = telefone.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Olá, vi "${contexto}" na ANGROLINK e gostaria de saber mais detalhes.`
  );

  return `https://wa.me/${numero}?text=${mensagem}`;
}
