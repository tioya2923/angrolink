/**
 * ========================================
 * CONSTANTES — Dados estáticos
 * ========================================
 */

import { Provincia, Municipio, Categoria, TipoVendedor } from '@/tipos';

// --- Províncias de Angola ---
// Divisão político-administrativa em vigor desde 01/01/2025 (21 províncias, 326 municípios).
export const PROVINCIAS: Provincia[] = [
  { id: 'bengo', nome: 'Bengo' },
  { id: 'benguela', nome: 'Benguela' },
  { id: 'bie', nome: 'Bié' },
  { id: 'cabinda', nome: 'Cabinda' },
  { id: 'cuando', nome: 'Cuando' },
  { id: 'cuanza-norte', nome: 'Cuanza Norte' },
  { id: 'cuanza-sul', nome: 'Cuanza Sul' },
  { id: 'cubango', nome: 'Cubango' },
  { id: 'cunene', nome: 'Cunene' },
  { id: 'huambo', nome: 'Huambo' },
  { id: 'huila', nome: 'Huíla' },
  { id: 'icolo-e-bengo', nome: 'Icolo e Bengo' },
  { id: 'luanda', nome: 'Luanda' },
  { id: 'lunda-norte', nome: 'Lunda Norte' },
  { id: 'lunda-sul', nome: 'Lunda Sul' },
  { id: 'malanje', nome: 'Malanje' },
  { id: 'moxico', nome: 'Moxico' },
  { id: 'moxico-leste', nome: 'Moxico Leste' },
  { id: 'namibe', nome: 'Namibe' },
  { id: 'uige', nome: 'Uíge' },
  { id: 'zaire', nome: 'Zaire' },
];

// --- Municípios de Angola ---
// Lista completa dos 326 municípios da nova divisão político-administrativa (2025).
export const MUNICIPIOS: Municipio[] = [
  // Bengo
  { id: 'ambriz', nome: 'Ambriz', provincia_id: 'bengo' },
  { id: 'bula-atumba', nome: 'Bula Atumba', provincia_id: 'bengo' },
  { id: 'dande', nome: 'Dande', provincia_id: 'bengo' },
  { id: 'nambuangongo', nome: 'Nambuangongo', provincia_id: 'bengo' },
  { id: 'pango-aluquem', nome: 'Pango Aluquém', provincia_id: 'bengo' },
  { id: 'quibaxe', nome: 'Quibaxe', provincia_id: 'bengo' },
  { id: 'muxaluando', nome: 'Muxaluando', provincia_id: 'bengo' },
  { id: 'piri', nome: 'Piri', provincia_id: 'bengo' },
  { id: 'quicunzo', nome: 'Quicunzo', provincia_id: 'bengo' },
  { id: 'ucua', nome: 'Úcua', provincia_id: 'bengo' },
  { id: 'panguila', nome: 'Panguila', provincia_id: 'bengo' },
  { id: 'barra-do-dande', nome: 'Barra do Dande', provincia_id: 'bengo' },

  // Benguela
  { id: 'baia-farta', nome: 'Baía Farta', provincia_id: 'benguela' },
  { id: 'balombo', nome: 'Balombo', provincia_id: 'benguela' },
  { id: 'benguela-cidade', nome: 'Benguela', provincia_id: 'benguela' },
  { id: 'bocoio', nome: 'Bocoio', provincia_id: 'benguela' },
  { id: 'caimbambo', nome: 'Caimbambo', provincia_id: 'benguela' },
  { id: 'catumbela', nome: 'Catumbela', provincia_id: 'benguela' },
  { id: 'chongoroi', nome: 'Chongorói', provincia_id: 'benguela' },
  { id: 'cubal', nome: 'Cubal', provincia_id: 'benguela' },
  { id: 'ganda', nome: 'Ganda', provincia_id: 'benguela' },
  { id: 'lobito', nome: 'Lobito', provincia_id: 'benguela' },
  { id: 'egito-praia', nome: 'Egito Praia', provincia_id: 'benguela' },
  { id: 'chindumbo', nome: 'Chindumbo', provincia_id: 'benguela' },
  { id: 'dombe-grande', nome: 'Dombe Grande', provincia_id: 'benguela' },
  { id: 'capupa', nome: 'Capupa', provincia_id: 'benguela' },
  { id: 'biopio', nome: 'Biópio', provincia_id: 'benguela' },
  { id: 'chila', nome: 'Chila', provincia_id: 'benguela' },
  { id: 'chicuma', nome: 'Chicuma', provincia_id: 'benguela' },
  { id: 'babaera', nome: 'Babaera', provincia_id: 'benguela' },
  { id: 'iambala', nome: 'Iambala', provincia_id: 'benguela' },
  { id: 'catengue', nome: 'Catengue', provincia_id: 'benguela' },
  { id: 'bolonguera', nome: 'Bolonguera', provincia_id: 'benguela' },
  { id: 'canhamela', nome: 'Canhamela', provincia_id: 'benguela' },
  { id: 'navegantes', nome: 'Navegantes', provincia_id: 'benguela' },

  // Bié
  { id: 'andulo', nome: 'Andulo', provincia_id: 'bie' },
  { id: 'camacupa', nome: 'Camacupa', provincia_id: 'bie' },
  { id: 'catabola', nome: 'Catabola', provincia_id: 'bie' },
  { id: 'chinguar', nome: 'Chinguar', provincia_id: 'bie' },
  { id: 'chitembo', nome: 'Chitembo', provincia_id: 'bie' },
  { id: 'cuemba', nome: 'Cuemba', provincia_id: 'bie' },
  { id: 'cunhinga', nome: 'Cunhinga', provincia_id: 'bie' },
  { id: 'cuito', nome: 'Cuito', provincia_id: 'bie' },
  { id: 'nharea', nome: 'Nharêa', provincia_id: 'bie' },
  { id: 'luando', nome: 'Luando', provincia_id: 'bie' },
  { id: 'ringoma', nome: 'Ringoma', provincia_id: 'bie' },
  { id: 'mumbue', nome: 'Mumbuê', provincia_id: 'bie' },
  { id: 'calucing', nome: 'Calucing', provincia_id: 'bie' },
  { id: 'chicala-bie', nome: 'Chicala', provincia_id: 'bie' },
  { id: 'chipeta', nome: 'Chipeta', provincia_id: 'bie' },
  { id: 'umpulo', nome: 'Umpulo', provincia_id: 'bie' },
  { id: 'lubia', nome: 'Lúbia', provincia_id: 'bie' },
  { id: 'cambandua', nome: 'Cambândua', provincia_id: 'bie' },
  { id: 'belo-horizonte', nome: 'Belo Horizonte', provincia_id: 'bie' },

  // Cabinda
  { id: 'cabinda-cidade', nome: 'Cabinda', provincia_id: 'cabinda' },
  { id: 'cacongo', nome: 'Cacongo', provincia_id: 'cabinda' },
  { id: 'buco-zau', nome: 'Buco-Zau', provincia_id: 'cabinda' },
  { id: 'belize', nome: 'Belize', provincia_id: 'cabinda' },
  { id: 'miconje', nome: 'Miconje', provincia_id: 'cabinda' },
  { id: 'massabi', nome: 'Massabi', provincia_id: 'cabinda' },
  { id: 'necuto', nome: 'Necuto', provincia_id: 'cabinda' },
  { id: 'tando-zinze', nome: 'Tando Zinze', provincia_id: 'cabinda' },
  { id: 'liambo', nome: 'Liambo', provincia_id: 'cabinda' },
  { id: 'ngoio', nome: 'Ngoio', provincia_id: 'cabinda' },

  // Cuando
  { id: 'cuito-cuanavale', nome: 'Cuito Cuanavale', provincia_id: 'cuando' },
  { id: 'dirico', nome: 'Dirico', provincia_id: 'cuando' },
  { id: 'mavinga', nome: 'Mavinga', provincia_id: 'cuando' },
  { id: 'rivungo', nome: 'Rivungo', provincia_id: 'cuando' },
  { id: 'xipundo', nome: 'Xipundo', provincia_id: 'cuando' },
  { id: 'dima', nome: 'Dima', provincia_id: 'cuando' },
  { id: 'luiana', nome: 'Luiana', provincia_id: 'cuando' },
  { id: 'mucusso', nome: 'Mucusso', provincia_id: 'cuando' },
  { id: 'luengue', nome: 'Luengue', provincia_id: 'cuando' },

  // Cuanza Norte
  { id: 'ambaca', nome: 'Ambaca', provincia_id: 'cuanza-norte' },
  { id: 'banga', nome: 'Banga', provincia_id: 'cuanza-norte' },
  { id: 'bolongongo', nome: 'Bolongongo', provincia_id: 'cuanza-norte' },
  { id: 'cambambe', nome: 'Cambambe', provincia_id: 'cuanza-norte' },
  { id: 'cazengo', nome: 'Cazengo', provincia_id: 'cuanza-norte' },
  { id: 'golungo-alto', nome: 'Golungo Alto', provincia_id: 'cuanza-norte' },
  { id: 'ngonguembo', nome: 'Ngonguembo', provincia_id: 'cuanza-norte' },
  { id: 'lucala', nome: 'Lucala', provincia_id: 'cuanza-norte' },
  { id: 'quiculungo', nome: 'Quiculungo', provincia_id: 'cuanza-norte' },
  { id: 'samba-caju', nome: 'Samba Cajú', provincia_id: 'cuanza-norte' },
  { id: 'massangano', nome: 'Massangano', provincia_id: 'cuanza-norte' },
  { id: 'cerca', nome: 'Cêrca', provincia_id: 'cuanza-norte' },
  { id: 'tango', nome: 'Tango', provincia_id: 'cuanza-norte' },
  { id: 'terreiro', nome: 'Terreiro', provincia_id: 'cuanza-norte' },
  { id: 'aldeia-nova', nome: 'Aldeia Nova', provincia_id: 'cuanza-norte' },
  { id: 'caculo-cabaca', nome: 'Caculo Cabaça', provincia_id: 'cuanza-norte' },
  { id: 'luinga', nome: 'Luinga', provincia_id: 'cuanza-norte' },

  // Cuanza Sul
  { id: 'gabela', nome: 'Gabela', provincia_id: 'cuanza-sul' },
  { id: 'cassongue', nome: 'Cassongue', provincia_id: 'cuanza-sul' },
  { id: 'conda', nome: 'Conda', provincia_id: 'cuanza-sul' },
  { id: 'ebo', nome: 'Ebo', provincia_id: 'cuanza-sul' },
  { id: 'mussende', nome: 'Mussende', provincia_id: 'cuanza-sul' },
  { id: 'porto-amboim', nome: 'Porto Amboim', provincia_id: 'cuanza-sul' },
  { id: 'quilenda', nome: 'Quilenda', provincia_id: 'cuanza-sul' },
  { id: 'quibala', nome: 'Quibala', provincia_id: 'cuanza-sul' },
  { id: 'seles', nome: 'Seles', provincia_id: 'cuanza-sul' },
  { id: 'sumbe', nome: 'Sumbe', provincia_id: 'cuanza-sul' },
  { id: 'waku-kungo', nome: 'Waku Kungo', provincia_id: 'cuanza-sul' },
  { id: 'calulo', nome: 'Calulo', provincia_id: 'cuanza-sul' },
  { id: 'quirimbo', nome: 'Quirimbo', provincia_id: 'cuanza-sul' },
  { id: 'munenga', nome: 'Munenga', provincia_id: 'cuanza-sul' },
  { id: 'quissongo', nome: 'Quissongo', provincia_id: 'cuanza-sul' },
  { id: 'gungo', nome: 'Gungo', provincia_id: 'cuanza-sul' },
  { id: 'sanga', nome: 'Sanga', provincia_id: 'cuanza-sul' },
  { id: 'gangula', nome: 'Gangula', provincia_id: 'cuanza-sul' },
  { id: 'pambangala', nome: 'Pambangala', provincia_id: 'cuanza-sul' },
  { id: 'conde', nome: 'Condé', provincia_id: 'cuanza-sul' },
  { id: 'amboiva', nome: 'Amboiva', provincia_id: 'cuanza-sul' },
  { id: 'lonhe', nome: 'Lonhe', provincia_id: 'cuanza-sul' },
  { id: 'quenha', nome: 'Quenha', provincia_id: 'cuanza-sul' },
  { id: 'boa-entrada', nome: 'Boa Entrada', provincia_id: 'cuanza-sul' },

  // Cubango
  { id: 'menongue', nome: 'Menongue', provincia_id: 'cubango' },
  { id: 'cutato', nome: 'Cutato', provincia_id: 'cubango' },
  { id: 'cuchi', nome: 'Cuchi', provincia_id: 'cubango' },
  { id: 'longa', nome: 'Longa', provincia_id: 'cubango' },
  { id: 'chinguanja', nome: 'Chinguanja', provincia_id: 'cubango' },
  { id: 'caiundo', nome: 'Caiundo', provincia_id: 'cubango' },
  { id: 'savate', nome: 'Savate', provincia_id: 'cubango' },
  { id: 'cuangar', nome: 'Cuangar', provincia_id: 'cubango' },
  { id: 'calai', nome: 'Calai', provincia_id: 'cubango' },
  { id: 'mavengue', nome: 'Mavengue', provincia_id: 'cubango' },
  { id: 'nancova', nome: 'Nancova', provincia_id: 'cubango' },

  // Cunene
  { id: 'cahama', nome: 'Cahama', provincia_id: 'cunene' },
  { id: 'cuanhama', nome: 'Cuanhama', provincia_id: 'cunene' },
  { id: 'curoca', nome: 'Curoca', provincia_id: 'cunene' },
  { id: 'cuvelai', nome: 'Cuvelai', provincia_id: 'cunene' },
  { id: 'namacunde', nome: 'Namacunde', provincia_id: 'cunene' },
  { id: 'ombadja', nome: 'Ombadja', provincia_id: 'cunene' },
  { id: 'chiede', nome: 'Chiéde', provincia_id: 'cunene' },
  { id: 'nehone', nome: 'Nehone', provincia_id: 'cunene' },
  { id: 'humbe', nome: 'Humbe', provincia_id: 'cunene' },
  { id: 'mupa', nome: 'Mupa', provincia_id: 'cunene' },
  { id: 'naulila', nome: 'Naulila', provincia_id: 'cunene' },
  { id: 'chitado', nome: 'Chitado', provincia_id: 'cunene' },
  { id: 'cafima', nome: 'Cafima', provincia_id: 'cunene' },
  { id: 'chissuata', nome: 'Chissuata', provincia_id: 'cunene' },

  // Huambo
  { id: 'longonjo', nome: 'Longonjo', provincia_id: 'huambo' },
  { id: 'bailundo', nome: 'Bailundo', provincia_id: 'huambo' },
  { id: 'chicala-choloanga', nome: 'Chicala Choloanga', provincia_id: 'huambo' },
  { id: 'mungo', nome: 'Mungo', provincia_id: 'huambo' },
  { id: 'chinjenje', nome: 'Chinjenje', provincia_id: 'huambo' },
  { id: 'ucuma', nome: 'Ucuma', provincia_id: 'huambo' },
  { id: 'cachiungo', nome: 'Cachiungo', provincia_id: 'huambo' },
  { id: 'caala', nome: 'Caála', provincia_id: 'huambo' },
  { id: 'ecunha', nome: 'Ecunha', provincia_id: 'huambo' },
  { id: 'huambo-cidade', nome: 'Huambo', provincia_id: 'huambo' },
  { id: 'londuimbali', nome: 'Londuimbali', provincia_id: 'huambo' },
  { id: 'bimbe', nome: 'Bimbe', provincia_id: 'huambo' },
  { id: 'sambo', nome: 'Sambo', provincia_id: 'huambo' },
  { id: 'galanga', nome: 'Galanga', provincia_id: 'huambo' },
  { id: 'alto-hama', nome: 'Alto Hama', provincia_id: 'huambo' },
  { id: 'chilata', nome: 'Chilata', provincia_id: 'huambo' },
  { id: 'cuima', nome: 'Cuima', provincia_id: 'huambo' },

  // Huíla
  { id: 'caconda', nome: 'Caconda', provincia_id: 'huila' },
  { id: 'cacula', nome: 'Cacula', provincia_id: 'huila' },
  { id: 'caluquembe', nome: 'Caluquembe', provincia_id: 'huila' },
  { id: 'gambos', nome: 'Gambos', provincia_id: 'huila' },
  { id: 'chibia', nome: 'Chibia', provincia_id: 'huila' },
  { id: 'chicomba', nome: 'Chicomba', provincia_id: 'huila' },
  { id: 'chipindo-huila', nome: 'Chipindo', provincia_id: 'huila' },
  { id: 'cuvango', nome: 'Cuvango', provincia_id: 'huila' },
  { id: 'humpata', nome: 'Humpata', provincia_id: 'huila' },
  { id: 'lubango', nome: 'Lubango', provincia_id: 'huila' },
  { id: 'matala', nome: 'Matala', provincia_id: 'huila' },
  { id: 'quilengues', nome: 'Quilengues', provincia_id: 'huila' },
  { id: 'quipungo', nome: 'Quipungo', provincia_id: 'huila' },
  { id: 'jamba-mineira', nome: 'Jamba Mineira', provincia_id: 'huila' },
  { id: 'dongo', nome: 'Dongo', provincia_id: 'huila' },
  { id: 'hoque', nome: 'Hoque', provincia_id: 'huila' },
  { id: 'capelongo', nome: 'Capelongo', provincia_id: 'huila' },
  { id: 'chituto', nome: 'Chituto', provincia_id: 'huila' },
  { id: 'capunda-cavilongo', nome: 'Capunda Cavilongo', provincia_id: 'huila' },
  { id: 'viti-vivali', nome: 'Viti Vivali', provincia_id: 'huila' },
  { id: 'galangue', nome: 'Galangue', provincia_id: 'huila' },
  { id: 'palanca', nome: 'Palanca', provincia_id: 'huila' },
  { id: 'chicungo', nome: 'Chicungo', provincia_id: 'huila' },

  // Icolo e Bengo
  { id: 'sequele', nome: 'Sequele', provincia_id: 'icolo-e-bengo' },
  { id: 'cabo-ledo', nome: 'Cabo Ledo', provincia_id: 'icolo-e-bengo' },
  { id: 'bom-jesus', nome: 'Bom Jesus', provincia_id: 'icolo-e-bengo' },
  { id: 'cabiri', nome: 'Cabiri', provincia_id: 'icolo-e-bengo' },
  { id: 'catete', nome: 'Catete', provincia_id: 'icolo-e-bengo' },
  { id: 'calumbo', nome: 'Calumbo', provincia_id: 'icolo-e-bengo' },
  { id: 'quicama', nome: 'Quiçama', provincia_id: 'icolo-e-bengo' },

  // Luanda
  { id: 'luanda-cidade', nome: 'Luanda', provincia_id: 'luanda' },
  { id: 'cacuaco', nome: 'Cacuaco', provincia_id: 'luanda' },
  { id: 'cazenga', nome: 'Cazenga', provincia_id: 'luanda' },
  { id: 'viana', nome: 'Viana', provincia_id: 'luanda' },
  { id: 'belas', nome: 'Belas', provincia_id: 'luanda' },
  { id: 'talatona', nome: 'Talatona', provincia_id: 'luanda' },
  { id: 'mussulo', nome: 'Mussulo', provincia_id: 'luanda' },
  { id: 'sambizanga', nome: 'Sambizanga', provincia_id: 'luanda' },
  { id: 'rangel', nome: 'Rangel', provincia_id: 'luanda' },
  { id: 'maianga', nome: 'Maianga', provincia_id: 'luanda' },
  { id: 'samba', nome: 'Samba', provincia_id: 'luanda' },
  { id: 'camama', nome: 'Camama', provincia_id: 'luanda' },
  { id: 'mulenvos', nome: 'Mulenvos', provincia_id: 'luanda' },
  { id: 'kilamba', nome: 'Kilamba', provincia_id: 'luanda' },
  { id: 'hoji-ya-henda', nome: 'Hoji Ya Henda', provincia_id: 'luanda' },
  { id: 'ingombota', nome: 'Ingombota', provincia_id: 'luanda' },

  // Lunda Norte
  { id: 'cambulo', nome: 'Cambulo', provincia_id: 'lunda-norte' },
  { id: 'capenda-camulemba', nome: 'Capenda Camulemba', provincia_id: 'lunda-norte' },
  { id: 'caungula', nome: 'Caungula', provincia_id: 'lunda-norte' },
  { id: 'chitato', nome: 'Chitato', provincia_id: 'lunda-norte' },
  { id: 'cuango', nome: 'Cuango', provincia_id: 'lunda-norte' },
  { id: 'cuilo', nome: 'Cuílo', provincia_id: 'lunda-norte' },
  { id: 'lubalo', nome: 'Lubalo', provincia_id: 'lunda-norte' },
  { id: 'lucapa', nome: 'Lucapa', provincia_id: 'lunda-norte' },
  { id: 'lovua', nome: 'Lóvua', provincia_id: 'lunda-norte' },
  { id: 'xa-muteba', nome: 'Xá-Muteba', provincia_id: 'lunda-norte' },
  { id: 'dundo', nome: 'Dundo', provincia_id: 'lunda-norte' },
  { id: 'xa-cassau', nome: 'Xá Cassau', provincia_id: 'lunda-norte' },
  { id: 'camaxilo', nome: 'Camaxilo', provincia_id: 'lunda-norte' },
  { id: 'luangue', nome: 'Luangue', provincia_id: 'lunda-norte' },
  { id: 'luremo', nome: 'Luremo', provincia_id: 'lunda-norte' },
  { id: 'canzar', nome: 'Canzar', provincia_id: 'lunda-norte' },
  { id: 'cassanje-calucala', nome: 'Cassanje Calucala', provincia_id: 'lunda-norte' },
  { id: 'mussungue', nome: 'Mussungue', provincia_id: 'lunda-norte' },
  { id: 'cafunfu', nome: 'Cafunfu', provincia_id: 'lunda-norte' },

  // Lunda Sul
  { id: 'cacolo', nome: 'Cacolo', provincia_id: 'lunda-sul' },
  { id: 'dala', nome: 'Dala', provincia_id: 'lunda-sul' },
  { id: 'muconda', nome: 'Muconda', provincia_id: 'lunda-sul' },
  { id: 'saurimo', nome: 'Saurimo', provincia_id: 'lunda-sul' },
  { id: 'chiluage', nome: 'Chiluage', provincia_id: 'lunda-sul' },
  { id: 'cassai-sul', nome: 'Cassai-Sul', provincia_id: 'lunda-sul' },
  { id: 'xassengue', nome: 'Xassengue', provincia_id: 'lunda-sul' },
  { id: 'alto-chicapa', nome: 'Alto Chicapa', provincia_id: 'lunda-sul' },
  { id: 'sombo', nome: 'Sombo', provincia_id: 'lunda-sul' },
  { id: 'muriege', nome: 'Muriege', provincia_id: 'lunda-sul' },
  { id: 'luma-cassai', nome: 'Luma Cassai', provincia_id: 'lunda-sul' },
  { id: 'cazage', nome: 'Cazage', provincia_id: 'lunda-sul' },
  { id: 'muangueji', nome: 'Muangueji', provincia_id: 'lunda-sul' },
  { id: 'cassengo', nome: 'Cassengo', provincia_id: 'lunda-sul' },

  // Malanje
  { id: 'cacuso', nome: 'Cacuso', provincia_id: 'malanje' },
  { id: 'cahombo', nome: 'Cahombo', provincia_id: 'malanje' },
  { id: 'calandula', nome: 'Calandula', provincia_id: 'malanje' },
  { id: 'cambundi-catembo', nome: 'Cambundi Catembo', provincia_id: 'malanje' },
  { id: 'cangandala', nome: 'Cangandala', provincia_id: 'malanje' },
  { id: 'kunda-dya-baze', nome: 'Kunda dya Baze', provincia_id: 'malanje' },
  { id: 'luquembo', nome: 'Luquembo', provincia_id: 'malanje' },
  { id: 'malanje-cidade', nome: 'Malanje', provincia_id: 'malanje' },
  { id: 'marimba', nome: 'Marimba', provincia_id: 'malanje' },
  { id: 'massango', nome: 'Massango', provincia_id: 'malanje' },
  { id: 'quela', nome: 'Quela', provincia_id: 'malanje' },
  { id: 'quirima', nome: 'Quirima', provincia_id: 'malanje' },
  { id: 'kiwaba-nzoji', nome: 'Kiwaba Nzoji', provincia_id: 'malanje' },
  { id: 'cateco-cangola', nome: 'Cateco Cangola', provincia_id: 'malanje' },
  { id: 'cuale', nome: 'Cuale', provincia_id: 'malanje' },
  { id: 'pungo-a-ndongo', nome: 'Pungo A Ndongo', provincia_id: 'malanje' },
  { id: 'ngola-luiji', nome: 'Ngola Luiji', provincia_id: 'malanje' },
  { id: 'quihuhu', nome: 'Quihuhu', provincia_id: 'malanje' },
  { id: 'xandel', nome: 'Xandel', provincia_id: 'malanje' },
  { id: 'cambo-suinginge', nome: 'Cambo Suinginge', provincia_id: 'malanje' },
  { id: 'milando', nome: 'Milando', provincia_id: 'malanje' },
  { id: 'quitapa', nome: 'Quitapa', provincia_id: 'malanje' },
  { id: 'capunda', nome: 'Capunda', provincia_id: 'malanje' },
  { id: 'muquixe', nome: 'Muquixe', provincia_id: 'malanje' },
  { id: 'quessua', nome: 'Quêssua', provincia_id: 'malanje' },
  { id: 'caculama', nome: 'Caculama', provincia_id: 'malanje' },
  { id: 'mbanji-ya-ngola', nome: 'Mbanji Ya Ngola', provincia_id: 'malanje' },

  // Moxico
  { id: 'camanongue', nome: 'Camanongue', provincia_id: 'moxico' },
  { id: 'leua', nome: 'Léua', provincia_id: 'moxico' },
  { id: 'chiume', nome: 'Chiúme', provincia_id: 'moxico' },
  { id: 'lumbala-nguimbo', nome: 'Lumbala Nguimbo', provincia_id: 'moxico' },
  { id: 'alto-cuito', nome: 'Alto Cuito', provincia_id: 'moxico' },
  { id: 'lutembo', nome: 'Lutembo', provincia_id: 'moxico' },
  { id: 'cangumbe', nome: 'Cangumbe', provincia_id: 'moxico' },
  { id: 'luena', nome: 'Luena', provincia_id: 'moxico' },
  { id: 'cangamba', nome: 'Cangamba', provincia_id: 'moxico' },
  { id: 'lucusse', nome: 'Lucusse', provincia_id: 'moxico' },
  { id: 'ninda', nome: 'Ninda', provincia_id: 'moxico' },
  { id: 'lutuai', nome: 'Lutuai', provincia_id: 'moxico' },

  // Moxico Leste
  { id: 'cazombo', nome: 'Cazombo', provincia_id: 'moxico-leste' },
  { id: 'luacano', nome: 'Luacano', provincia_id: 'moxico-leste' },
  { id: 'cameia', nome: 'Cameia', provincia_id: 'moxico-leste' },
  { id: 'luau', nome: 'Luau', provincia_id: 'moxico-leste' },
  { id: 'nana-candundo', nome: 'Nana Candundo', provincia_id: 'moxico-leste' },
  { id: 'macondo', nome: 'Macondo', provincia_id: 'moxico-leste' },
  { id: 'caianda', nome: 'Caianda', provincia_id: 'moxico-leste' },
  { id: 'lovua-do-zambeze', nome: 'Lóvua do Zambeze', provincia_id: 'moxico-leste' },
  { id: 'lago-dilolo', nome: 'Lago Dilolo', provincia_id: 'moxico-leste' },

  // Namibe
  { id: 'mocamedes', nome: 'Moçâmedes', provincia_id: 'namibe' },
  { id: 'camucuio', nome: 'Camucuio', provincia_id: 'namibe' },
  { id: 'bibala', nome: 'Bibala', provincia_id: 'namibe' },
  { id: 'virei', nome: 'Virei', provincia_id: 'namibe' },
  { id: 'tombua', nome: 'Tômbua', provincia_id: 'namibe' },
  { id: 'lucira', nome: 'Lucira', provincia_id: 'namibe' },
  { id: 'iona', nome: 'Iona', provincia_id: 'namibe' },
  { id: 'sacomar', nome: 'Sacomar', provincia_id: 'namibe' },
  { id: 'cacimbas', nome: 'Cacimbas', provincia_id: 'namibe' },

  // Uíge
  { id: 'uige-cidade', nome: 'Uíge', provincia_id: 'uige' },
  { id: 'ambuila', nome: 'Ambuíla', provincia_id: 'uige' },
  { id: 'bembe', nome: 'Bembe', provincia_id: 'uige' },
  { id: 'bungo', nome: 'Bungo', provincia_id: 'uige' },
  { id: 'milunga', nome: 'Milunga', provincia_id: 'uige' },
  { id: 'damba', nome: 'Damba', provincia_id: 'uige' },
  { id: 'maquela-do-zombo', nome: 'Maquela do Zombo', provincia_id: 'uige' },
  { id: 'mucaba', nome: 'Mucaba', provincia_id: 'uige' },
  { id: 'negage', nome: 'Negage', provincia_id: 'uige' },
  { id: 'puri', nome: 'Puri', provincia_id: 'uige' },
  { id: 'quimbele', nome: 'Quimbele', provincia_id: 'uige' },
  { id: 'sanza-pombo', nome: 'Sanza Pombo', provincia_id: 'uige' },
  { id: 'songo', nome: 'Songo', provincia_id: 'uige' },
  { id: 'cangola-uige', nome: 'Cangola', provincia_id: 'uige' },
  { id: 'nova-esperanca', nome: 'Nova Esperança', provincia_id: 'uige' },
  { id: 'dange-quitexe', nome: 'Dange Quitexe', provincia_id: 'uige' },
  { id: 'sacandica', nome: 'Sacandica', provincia_id: 'uige' },
  { id: 'nsosso', nome: 'Nsosso', provincia_id: 'uige' },
  { id: 'lucunga', nome: 'Lucunga', provincia_id: 'uige' },
  { id: 'quipedro', nome: 'Quipedro', provincia_id: 'uige' },
  { id: 'massau', nome: 'Massau', provincia_id: 'uige' },
  { id: 'vista-alegre', nome: 'Vista Alegre', provincia_id: 'uige' },
  { id: 'alto-zaza', nome: 'Alto Zaza', provincia_id: 'uige' },

  // Zaire
  { id: 'mbanza-kongo', nome: 'Mbanza Kongo', provincia_id: 'zaire' },
  { id: 'soyo', nome: 'Soyo', provincia_id: 'zaire' },
  { id: 'nzeto', nome: 'Nzeto', provincia_id: 'zaire' },
  { id: 'cuimba', nome: 'Cuimba', provincia_id: 'zaire' },
  { id: 'noqui', nome: 'Nóqui', provincia_id: 'zaire' },
  { id: 'tomboco', nome: 'Tomboco', provincia_id: 'zaire' },
  { id: 'luvo', nome: 'Luvo', provincia_id: 'zaire' },
  { id: 'lufico', nome: 'Lufico', provincia_id: 'zaire' },
  { id: 'quelo', nome: 'Quêlo', provincia_id: 'zaire' },
  { id: 'serra-de-canda', nome: 'Serra de Canda', provincia_id: 'zaire' },
  { id: 'quindeje', nome: 'Quindeje', provincia_id: 'zaire' },
];

// --- Categorias de Produtos ---
export const CATEGORIAS: Categoria[] = [
  { id: 'frescos', nome_categoria: 'Produtos Frescos', icone: 'Leaf', ordem_exibicao: 1 },
  { id: 'graos', nome_categoria: 'Grãos e Cereais', icone: 'Wheat', ordem_exibicao: 2 },
  { id: 'pecuaria', nome_categoria: 'Pecuária', icone: 'Beef', ordem_exibicao: 3 },
  { id: 'bebidas', nome_categoria: 'Bebidas', icone: 'Wine', ordem_exibicao: 4 },
  { id: 'alimentos', nome_categoria: 'Alimentos', icone: 'UtensilsCrossed', ordem_exibicao: 5 },
];

// --- Tipos de vendedor ---
// Reflete os vários níveis do comércio angolano, do informal ao grande retalho.
// Os documentos exigidos por tipo estão definidos em @/dados/documentosVendedor.
export const TIPOS_VENDEDOR: {
  valor: TipoVendedor;
  rotulo: string;
  icone: string;
  descricao: string;
  exemplos: string;
}[] = [
  {
    valor: 'ambulante',
    rotulo: 'Vendedora Ambulante / Zungueira',
    icone: '🧺',
    descricao: 'Vende de forma ambulante, na rua ou de porta em porta, sem local fixo.',
    exemplos: 'Zungueiras, vendedores de rua, venda ambulante de produtos',
  },
  {
    valor: 'quitandeira',
    rotulo: 'Quitandeira',
    icone: '🥬',
    descricao: 'Vende produtos frescos ou variados numa banca informal, dentro ou fora de um mercado.',
    exemplos: 'Banca de fruta e verdura, quitanda de bairro',
  },
  {
    valor: 'produtor',
    rotulo: 'Produtor',
    icone: '🌾',
    descricao: 'Produz diretamente da terra ou cria animais, com ou sem propriedade agrícola formal.',
    exemplos: 'Milho, hortaliças, frutas, gado, galinhas, quintas e fazendas',
  },
  {
    valor: 'mini_mercado',
    rotulo: 'Mini Mercado / Mercearia',
    icone: '🏪',
    descricao: 'Loja pequena e fixa, geralmente de bairro, com produtos variados.',
    exemplos: 'Mercearia, loja de bairro, mini-mercado',
  },
  {
    valor: 'revendedor',
    rotulo: 'Revendedor / Banca de Mercado',
    icone: '🥕',
    descricao: 'Tem uma banca fixa dentro de um mercado municipal ou informal.',
    exemplos: 'Banca no mercado do bairro, banca de talho ou de secos e molhados',
  },
  {
    valor: 'supermercado',
    rotulo: 'Supermercado',
    icone: '🛒',
    descricao: 'Loja de médio ou grande porte, formalizada, com várias secções de produtos.',
    exemplos: 'Supermercados de bairro ou de cadeia local',
  },
  {
    valor: 'hipermercado',
    rotulo: 'Hipermercado / Grande Distribuidor',
    icone: '🏬',
    descricao: 'Grande superfície comercial ou cadeia de distribuição em várias províncias.',
    exemplos: 'Hipermercados, grandes cadeias de distribuição',
  },
  {
    valor: 'grossista',
    rotulo: 'Venda por Grosso',
    icone: '📦',
    descricao: 'Vende grandes quantidades para lojas, mercados ou revendedores.',
    exemplos: 'Paletes de bebidas, sacos de arroz, caixas de frango',
  },
];

/** Helper: obter badge do tipo de vendedor */
export function obterBadgeVendedor(tipo: TipoVendedor): { icone: string; rotulo: string } {
  const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipo);

  if (!t) {
    return { icone: '🏷️', rotulo: 'Vendedor' };
  }

  const rotuloCurto: Record<TipoVendedor, string> = {
    ambulante: 'Ambulante',
    quitandeira: 'Quitandeira',
    produtor: 'Produtor',
    mini_mercado: 'Mini Mercado',
    revendedor: 'Revendedor',
    supermercado: 'Supermercado',
    hipermercado: 'Hipermercado',
    grossista: 'Grosso',
    prestador_servico: 'Serviços',
  };

  return {
    icone: t.icone,
    rotulo: rotuloCurto[tipo],
  };
}

/** Serviços anunciáveis por perfis profissionais. A plataforma não inclui transporte de passageiros. */
export const TIPOS_SERVICO = [
  'Entrega de mercadorias',
  'Transporte de mercadorias',
  'Moagem',
  'Limpeza',
  'Reparação',
  'Aluguer de Equipamento',
  'Mão de obra agrícola',
  'Consultoria',
  'Outros',
] as const;

/** Helper: obter "ícone + rótulo completo" do tipo de vendedor (ex: para listas de admin) */
export function obterRotuloCompletoVendedor(tipo: string): string {
  const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipo);
  return t ? `${t.icone} ${t.rotulo}` : tipo;
}

// --- Unidades de medida ---
export const UNIDADES = [
  { valor: 'kg', rotulo: 'Kg' },
  { valor: 'saco', rotulo: 'Saco' },
  { valor: 'caixa', rotulo: 'Caixa' },
  { valor: 'litro', rotulo: 'Litro' },
  { valor: 'unidade', rotulo: 'Unidade' },
  { valor: 'animal', rotulo: 'Animal' },
] as const;

// --- Tipos de venda ---
export const TIPOS_VENDA = [
  { valor: 'grosso', rotulo: 'Grosso' },
  { valor: 'retalho', rotulo: 'Retalho' },
  { valor: 'ambos', rotulo: 'Ambos' },
] as const;
