export function formatarTempoRelativo(
  data: string
) {
  const agora = new Date();
  const dataItem = new Date(data);

  const diff =
    agora.getTime() -
    dataItem.getTime();

  const minutos = Math.floor(
    diff / (1000 * 60)
  );

  const horas = Math.floor(
    minutos / 60
  );

  const dias = Math.floor(
    horas / 24
  );

  if (minutos < 1) {
    return 'Agora mesmo';
  }

  if (minutos < 60) {
    return `Há ${minutos} min`;
  }

  if (horas < 24) {
    return `Há ${horas} h`;
  }

  if (dias === 1) {
    return 'Ontem';
  }

  if (dias < 7) {
    return `Há ${dias} dias`;
  }

  if (dias < 30) {
    const semanas = Math.floor(
      dias / 7
    );

    return `Há ${semanas} semana${
      semanas > 1 ? 's' : ''
    }`;
  }

  const meses = Math.floor(
    dias / 30
  );

  if (meses < 12) {
    return `Há ${meses} mês${
      meses > 1 ? 'es' : ''
    }`;
  }

  const anos = Math.floor(
    meses / 12
  );

  return `Há ${anos} ano${
    anos > 1 ? 's' : ''
  }`;
}