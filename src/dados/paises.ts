/**
 * Lista de países com indicativo telefónico internacional (ITU),
 * usada pelo seletor de indicativo nos formulários com número de telefone.
 *
 * Os nomes são resolvidos via Intl.DisplayNames (locale pt) e a bandeira
 * é calculada a partir do código ISO 3166-1 alpha-2 — não há listas
 * paralelas de nomes/bandeiras para manter sincronizadas.
 */

export interface Pais {
  iso2: string;
  nome: string;
  indicativo: string;
  bandeira: string;
}

// [ISO 3166-1 alpha-2, indicativo internacional sem "+"]
const CODIGOS: [string, string][] = [
  // África
  ['DZ', '213'], ['AO', '244'], ['BJ', '229'], ['BW', '267'], ['BF', '226'],
  ['BI', '257'], ['CM', '237'], ['CV', '238'], ['CF', '236'], ['TD', '235'],
  ['KM', '269'], ['CG', '242'], ['CD', '243'], ['CI', '225'], ['DJ', '253'],
  ['EG', '20'], ['GQ', '240'], ['ER', '291'], ['SZ', '268'], ['ET', '251'],
  ['GA', '241'], ['GM', '220'], ['GH', '233'], ['GN', '224'], ['GW', '245'],
  ['KE', '254'], ['LS', '266'], ['LR', '231'], ['LY', '218'], ['MG', '261'],
  ['MW', '265'], ['ML', '223'], ['MR', '222'], ['MU', '230'], ['MA', '212'],
  ['MZ', '258'], ['NA', '264'], ['NE', '227'], ['NG', '234'], ['RW', '250'],
  ['ST', '239'], ['SN', '221'], ['SC', '248'], ['SL', '232'], ['SO', '252'],
  ['ZA', '27'], ['SS', '211'], ['SD', '249'], ['TZ', '255'], ['TG', '228'],
  ['TN', '216'], ['UG', '256'], ['ZM', '260'], ['ZW', '263'],

  // Europa
  ['AL', '355'], ['AD', '376'], ['AT', '43'], ['BY', '375'], ['BE', '32'],
  ['BA', '387'], ['BG', '359'], ['HR', '385'], ['CY', '357'], ['CZ', '420'],
  ['DK', '45'], ['EE', '372'], ['FI', '358'], ['FR', '33'], ['DE', '49'],
  ['GR', '30'], ['HU', '36'], ['IS', '354'], ['IE', '353'], ['IT', '39'],
  ['LV', '371'], ['LI', '423'], ['LT', '370'], ['LU', '352'], ['MT', '356'],
  ['MD', '373'], ['MC', '377'], ['ME', '382'], ['NL', '31'], ['MK', '389'],
  ['NO', '47'], ['PL', '48'], ['PT', '351'], ['RO', '40'], ['RU', '7'],
  ['SM', '378'], ['RS', '381'], ['SK', '421'], ['SI', '386'], ['ES', '34'],
  ['SE', '46'], ['CH', '41'], ['UA', '380'], ['GB', '44'], ['VA', '379'],

  // Ásia
  ['AF', '93'], ['AM', '374'], ['AZ', '994'], ['BH', '973'], ['BD', '880'],
  ['BT', '975'], ['BN', '673'], ['KH', '855'], ['CN', '86'], ['GE', '995'],
  ['HK', '852'], ['IN', '91'], ['ID', '62'], ['IR', '98'], ['IQ', '964'],
  ['IL', '972'], ['JP', '81'], ['JO', '962'], ['KZ', '7'], ['KW', '965'],
  ['KG', '996'], ['LA', '856'], ['LB', '961'], ['MO', '853'], ['MY', '60'],
  ['MV', '960'], ['MN', '976'], ['MM', '95'], ['NP', '977'], ['KP', '850'],
  ['OM', '968'], ['PK', '92'], ['PS', '970'], ['PH', '63'], ['QA', '974'],
  ['SA', '966'], ['SG', '65'], ['KR', '82'], ['LK', '94'], ['SY', '963'],
  ['TW', '886'], ['TJ', '992'], ['TH', '66'], ['TL', '670'], ['TR', '90'],
  ['TM', '993'], ['AE', '971'], ['UZ', '998'], ['VN', '84'], ['YE', '967'],

  // Oceania
  ['AU', '61'], ['FJ', '679'], ['KI', '686'], ['MH', '692'], ['FM', '691'],
  ['NR', '674'], ['NZ', '64'], ['PW', '680'], ['PG', '675'], ['WS', '685'],
  ['SB', '677'], ['TO', '676'], ['TV', '688'], ['VU', '678'],

  // Américas
  ['AG', '1268'], ['AR', '54'], ['BS', '1242'], ['BB', '1246'], ['BZ', '501'],
  ['BO', '591'], ['BR', '55'], ['CA', '1'], ['CL', '56'], ['CO', '57'],
  ['CR', '506'], ['CU', '53'], ['DM', '1767'], ['DO', '1809'], ['EC', '593'],
  ['SV', '503'], ['GD', '1473'], ['GT', '502'], ['GY', '592'], ['HT', '509'],
  ['HN', '504'], ['JM', '1876'], ['MX', '52'], ['NI', '505'], ['PA', '507'],
  ['PY', '595'], ['PE', '51'], ['KN', '1869'], ['LC', '1758'], ['VC', '1784'],
  ['SR', '597'], ['TT', '1868'], ['US', '1'], ['UY', '598'], ['VE', '58'],
];

function bandeiraDeIso2(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

const nomesPt =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['pt'], { type: 'region' })
    : null;

export const PAISES: Pais[] = CODIGOS
  .map(([iso2, indicativo]) => ({
    iso2,
    nome: nomesPt?.of(iso2) ?? iso2,
    indicativo,
    bandeira: bandeiraDeIso2(iso2),
  }))
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));

export const PAIS_PADRAO: Pais =
  PAISES.find(p => p.iso2 === 'AO') ?? PAISES[0];

/**
 * Dado um indicativo (ex: "244"), devolve o país correspondente.
 * Em caso de indicativos partilhados (ex: NANP "1"), devolve o primeiro
 * país da lista com esse indicativo.
 */
export function paisPorIndicativo(indicativo: string): Pais {
  return PAISES.find(p => p.indicativo === indicativo) ?? PAIS_PADRAO;
}

/**
 * Separa um número completo (com ou sem "+") no indicativo do país e no
 * número local, tentando o indicativo mais longo (mais específico) que
 * seja prefixo dos dígitos recebidos. Usado para reconstruir o indicativo
 * de números já guardados (ex: "+244923456789").
 */
export function separarIndicativo(
  numeroCompleto: string
): { indicativo: string; numero: string } {
  const digitos = numeroCompleto.replace(/\D/g, '');

  const candidatos = [...PAISES].sort(
    (a, b) => b.indicativo.length - a.indicativo.length
  );

  for (const pais of candidatos) {
    if (digitos.startsWith(pais.indicativo) && digitos.length > pais.indicativo.length) {
      return {
        indicativo: pais.indicativo,
        numero: digitos.slice(pais.indicativo.length),
      };
    }
  }

  return { indicativo: PAIS_PADRAO.indicativo, numero: digitos };
}
