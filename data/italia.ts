// Italian regions, provinces, and municipalities data
// This is a representative subset - full data would include all 7904 comuni

export interface Regione {
  codice: string;
  nome: string;
  slug: string;
}

export interface Provincia {
  codice: string;
  nome: string;
  slug: string;
  sigla: string;
  regione: string; // codice regione
}

export interface Comune {
  codice: string;
  nome: string;
  slug: string;
  provincia: string; // codice provincia
  cap: string;
  popolazione?: number;
}

export const regioni: Regione[] = [
  { codice: '01', nome: 'Piemonte', slug: 'piemonte' },
  { codice: '02', nome: "Valle d'Aosta", slug: 'valle-d-aosta' },
  { codice: '03', nome: 'Lombardia', slug: 'lombardia' },
  { codice: '04', nome: 'Trentino-Alto Adige', slug: 'trentino-alto-adige' },
  { codice: '05', nome: 'Veneto', slug: 'veneto' },
  { codice: '06', nome: 'Friuli-Venezia Giulia', slug: 'friuli-venezia-giulia' },
  { codice: '07', nome: 'Liguria', slug: 'liguria' },
  { codice: '08', nome: 'Emilia-Romagna', slug: 'emilia-romagna' },
  { codice: '09', nome: 'Toscana', slug: 'toscana' },
  { codice: '10', nome: 'Umbria', slug: 'umbria' },
  { codice: '11', nome: 'Marche', slug: 'marche' },
  { codice: '12', nome: 'Lazio', slug: 'lazio' },
  { codice: '13', nome: 'Abruzzo', slug: 'abruzzo' },
  { codice: '14', nome: 'Molise', slug: 'molise' },
  { codice: '15', nome: 'Campania', slug: 'campania' },
  { codice: '16', nome: 'Puglia', slug: 'puglia' },
  { codice: '17', nome: 'Basilicata', slug: 'basilicata' },
  { codice: '18', nome: 'Calabria', slug: 'calabria' },
  { codice: '19', nome: 'Sicilia', slug: 'sicilia' },
  { codice: '20', nome: 'Sardegna', slug: 'sardegna' },
];

export const province: Provincia[] = [
  // Piemonte
  { codice: '001', nome: 'Torino', slug: 'torino', sigla: 'TO', regione: '01' },
  { codice: '002', nome: 'Vercelli', slug: 'vercelli', sigla: 'VC', regione: '01' },
  { codice: '003', nome: 'Novara', slug: 'novara', sigla: 'NO', regione: '01' },
  { codice: '004', nome: 'Cuneo', slug: 'cuneo', sigla: 'CN', regione: '01' },
  { codice: '005', nome: 'Asti', slug: 'asti', sigla: 'AT', regione: '01' },
  { codice: '006', nome: 'Alessandria', slug: 'alessandria', sigla: 'AL', regione: '01' },

  // Lombardia
  { codice: '012', nome: 'Varese', slug: 'varese', sigla: 'VA', regione: '03' },
  { codice: '013', nome: 'Como', slug: 'como', sigla: 'CO', regione: '03' },
  { codice: '015', nome: 'Milano', slug: 'milano', sigla: 'MI', regione: '03' },
  { codice: '016', nome: 'Bergamo', slug: 'bergamo', sigla: 'BG', regione: '03' },
  { codice: '017', nome: 'Brescia', slug: 'brescia', sigla: 'BS', regione: '03' },
  { codice: '018', nome: 'Pavia', slug: 'pavia', sigla: 'PV', regione: '03' },
  { codice: '019', nome: 'Cremona', slug: 'cremona', sigla: 'CR', regione: '03' },
  { codice: '020', nome: 'Mantova', slug: 'mantova', sigla: 'MN', regione: '03' },

  // Veneto
  { codice: '023', nome: 'Verona', slug: 'verona', sigla: 'VR', regione: '05' },
  { codice: '024', nome: 'Vicenza', slug: 'vicenza', sigla: 'VI', regione: '05' },
  { codice: '026', nome: 'Treviso', slug: 'treviso', sigla: 'TV', regione: '05' },
  { codice: '027', nome: 'Venezia', slug: 'venezia', sigla: 'VE', regione: '05' },
  { codice: '028', nome: 'Padova', slug: 'padova', sigla: 'PD', regione: '05' },

  // Emilia-Romagna
  { codice: '033', nome: 'Piacenza', slug: 'piacenza', sigla: 'PC', regione: '08' },
  { codice: '034', nome: 'Parma', slug: 'parma', sigla: 'PR', regione: '08' },
  { codice: '035', nome: "Reggio nell'Emilia", slug: 'reggio-emilia', sigla: 'RE', regione: '08' },
  { codice: '036', nome: 'Modena', slug: 'modena', sigla: 'MO', regione: '08' },
  { codice: '037', nome: 'Bologna', slug: 'bologna', sigla: 'BO', regione: '08' },

  // Toscana
  { codice: '045', nome: 'Massa-Carrara', slug: 'massa-carrara', sigla: 'MS', regione: '09' },
  { codice: '046', nome: 'Lucca', slug: 'lucca', sigla: 'LU', regione: '09' },
  { codice: '048', nome: 'Firenze', slug: 'firenze', sigla: 'FI', regione: '09' },
  { codice: '050', nome: 'Pisa', slug: 'pisa', sigla: 'PI', regione: '09' },
  { codice: '052', nome: 'Siena', slug: 'siena', sigla: 'SI', regione: '09' },

  // Lazio
  { codice: '056', nome: 'Viterbo', slug: 'viterbo', sigla: 'VT', regione: '12' },
  { codice: '057', nome: 'Rieti', slug: 'rieti', sigla: 'RI', regione: '12' },
  { codice: '058', nome: 'Roma', slug: 'roma', sigla: 'RM', regione: '12' },
  { codice: '059', nome: 'Latina', slug: 'latina', sigla: 'LT', regione: '12' },
  { codice: '060', nome: 'Frosinone', slug: 'frosinone', sigla: 'FR', regione: '12' },

  // Campania
  { codice: '061', nome: 'Caserta', slug: 'caserta', sigla: 'CE', regione: '15' },
  { codice: '062', nome: 'Benevento', slug: 'benevento', sigla: 'BN', regione: '15' },
  { codice: '063', nome: 'Napoli', slug: 'napoli', sigla: 'NA', regione: '15' },
  { codice: '064', nome: 'Avellino', slug: 'avellino', sigla: 'AV', regione: '15' },
  { codice: '065', nome: 'Salerno', slug: 'salerno', sigla: 'SA', regione: '15' },

  // Puglia
  { codice: '071', nome: 'Foggia', slug: 'foggia', sigla: 'FG', regione: '16' },
  { codice: '072', nome: 'Bari', slug: 'bari', sigla: 'BA', regione: '16' },
  { codice: '073', nome: 'Taranto', slug: 'taranto', sigla: 'TA', regione: '16' },
  { codice: '074', nome: 'Brindisi', slug: 'brindisi', sigla: 'BR', regione: '16' },
  { codice: '075', nome: 'Lecce', slug: 'lecce', sigla: 'LE', regione: '16' },

  // Sicilia
  { codice: '081', nome: 'Trapani', slug: 'trapani', sigla: 'TP', regione: '19' },
  { codice: '082', nome: 'Palermo', slug: 'palermo', sigla: 'PA', regione: '19' },
  { codice: '083', nome: 'Messina', slug: 'messina', sigla: 'ME', regione: '19' },
  { codice: '084', nome: 'Agrigento', slug: 'agrigento', sigla: 'AG', regione: '19' },
  { codice: '085', nome: 'Caltanissetta', slug: 'caltanissetta', sigla: 'CL', regione: '19' },
  { codice: '086', nome: 'Enna', slug: 'enna', sigla: 'EN', regione: '19' },
  { codice: '087', nome: 'Catania', slug: 'catania', sigla: 'CT', regione: '19' },
  { codice: '088', nome: 'Ragusa', slug: 'ragusa', sigla: 'RG', regione: '19' },
  { codice: '089', nome: 'Siracusa', slug: 'siracusa', sigla: 'SR', regione: '19' },

  // Sardegna
  { codice: '090', nome: 'Sassari', slug: 'sassari', sigla: 'SS', regione: '20' },
  { codice: '091', nome: 'Nuoro', slug: 'nuoro', sigla: 'NU', regione: '20' },
  { codice: '092', nome: 'Cagliari', slug: 'cagliari', sigla: 'CA', regione: '20' },
];

// Sample comuni for major cities (full list would include all 7904)
export const comuni: Comune[] = [
  // Milano area
  { codice: '015146', nome: 'Milano', slug: 'milano', provincia: '015', cap: '20100', popolazione: 1378689 },
  { codice: '015009', nome: 'Monza', slug: 'monza', provincia: '015', cap: '20900', popolazione: 123397 },
  { codice: '015002', nome: 'Sesto San Giovanni', slug: 'sesto-san-giovanni', provincia: '015', cap: '20099', popolazione: 81773 },
  { codice: '015003', nome: 'Cinisello Balsamo', slug: 'cinisello-balsamo', provincia: '015', cap: '20092', popolazione: 75319 },

  // Roma area
  { codice: '058091', nome: 'Roma', slug: 'roma', provincia: '058', cap: '00100', popolazione: 2873494 },
  { codice: '058029', nome: 'Fiumicino', slug: 'fiumicino', provincia: '058', cap: '00054', popolazione: 81894 },
  { codice: '058034', nome: 'Guidonia Montecelio', slug: 'guidonia-montecelio', provincia: '058', cap: '00012', popolazione: 88673 },

  // Napoli area
  { codice: '063049', nome: 'Napoli', slug: 'napoli', provincia: '063', cap: '80100', popolazione: 959574 },
  { codice: '063024', nome: 'Torre del Greco', slug: 'torre-del-greco', provincia: '063', cap: '80059', popolazione: 85946 },
  { codice: '063032', nome: 'Giugliano in Campania', slug: 'giugliano-in-campania', provincia: '063', cap: '80014', popolazione: 123839 },

  // Torino area
  { codice: '001272', nome: 'Torino', slug: 'torino', provincia: '001', cap: '10100', popolazione: 870952 },
  { codice: '001191', nome: 'Moncalieri', slug: 'moncalieri', provincia: '001', cap: '10024', popolazione: 57612 },
  { codice: '001263', nome: 'Collegno', slug: 'collegno', provincia: '001', cap: '10093', popolazione: 50137 },

  // Palermo area
  { codice: '082053', nome: 'Palermo', slug: 'palermo', provincia: '082', cap: '90100', popolazione: 663401 },
  { codice: '082006', nome: 'Bagheria', slug: 'bagheria', provincia: '082', cap: '90011', popolazione: 54876 },

  // Genova
  { codice: '010025', nome: 'Genova', slug: 'genova', provincia: '010', cap: '16100', popolazione: 566410 },

  // Bologna
  { codice: '037006', nome: 'Bologna', slug: 'bologna', provincia: '037', cap: '40100', popolazione: 390636 },
  { codice: '037003', nome: 'Imola', slug: 'imola', provincia: '037', cap: '40026', popolazione: 70076 },

  // Firenze
  { codice: '048017', nome: 'Firenze', slug: 'firenze', provincia: '048', cap: '50100', popolazione: 382258 },
  { codice: '048029', nome: 'Prato', slug: 'prato', provincia: '048', cap: '59100', popolazione: 194223 },

  // Bari
  { codice: '072006', nome: 'Bari', slug: 'bari', provincia: '072', cap: '70100', popolazione: 320475 },

  // Catania
  { codice: '087015', nome: 'Catania', slug: 'catania', provincia: '087', cap: '95100', popolazione: 311584 },

  // Venezia
  { codice: '027042', nome: 'Venezia', slug: 'venezia', provincia: '027', cap: '30100', popolazione: 261905 },

  // Verona
  { codice: '023091', nome: 'Verona', slug: 'verona', provincia: '023', cap: '37100', popolazione: 258108 },

  // Messina
  { codice: '083048', nome: 'Messina', slug: 'messina', provincia: '083', cap: '98100', popolazione: 227424 },

  // Padova
  { codice: '028060', nome: 'Padova', slug: 'padova', provincia: '028', cap: '35100', popolazione: 212224 },

  // Trieste
  { codice: '032006', nome: 'Trieste', slug: 'trieste', provincia: '032', cap: '34100', popolazione: 204338 },

  // Taranto
  { codice: '073027', nome: 'Taranto', slug: 'taranto', provincia: '073', cap: '74100', popolazione: 195000 },

  // Brescia
  { codice: '017029', nome: 'Brescia', slug: 'brescia', provincia: '017', cap: '25100', popolazione: 196480 },

  // Parma
  { codice: '034027', nome: 'Parma', slug: 'parma', provincia: '034', cap: '43100', popolazione: 198292 },

  // Modena
  { codice: '036023', nome: 'Modena', slug: 'modena', provincia: '036', cap: '41100', popolazione: 185273 },

  // Reggio Calabria
  { codice: '080063', nome: 'Reggio Calabria', slug: 'reggio-calabria', provincia: '080', cap: '89100', popolazione: 181447 },

  // Reggio Emilia
  { codice: '035033', nome: "Reggio nell'Emilia", slug: 'reggio-emilia', provincia: '035', cap: '42100', popolazione: 172525 },

  // Perugia
  { codice: '054039', nome: 'Perugia', slug: 'perugia', provincia: '054', cap: '06100', popolazione: 166134 },

  // Livorno
  { codice: '049009', nome: 'Livorno', slug: 'livorno', provincia: '049', cap: '57100', popolazione: 158371 },

  // Ravenna
  { codice: '039014', nome: 'Ravenna', slug: 'ravenna', provincia: '039', cap: '48100', popolazione: 159116 },

  // Cagliari
  { codice: '092009', nome: 'Cagliari', slug: 'cagliari', provincia: '092', cap: '09100', popolazione: 154460 },

  // Foggia
  { codice: '071024', nome: 'Foggia', slug: 'foggia', provincia: '071', cap: '71100', popolazione: 151991 },

  // Rimini
  { codice: '099014', nome: 'Rimini', slug: 'rimini', provincia: '099', cap: '47900', popolazione: 150755 },

  // Salerno
  { codice: '065116', nome: 'Salerno', slug: 'salerno', provincia: '065', cap: '84100', popolazione: 132608 },

  // Ferrara
  { codice: '038008', nome: 'Ferrara', slug: 'ferrara', provincia: '038', cap: '44100', popolazione: 132009 },

  // Sassari
  { codice: '090064', nome: 'Sassari', slug: 'sassari', provincia: '090', cap: '07100', popolazione: 127525 },

  // Latina
  { codice: '059011', nome: 'Latina', slug: 'latina', provincia: '059', cap: '04100', popolazione: 128140 },

  // Siracusa
  { codice: '089017', nome: 'Siracusa', slug: 'siracusa', provincia: '089', cap: '96100', popolazione: 121607 },

  // Pescara
  { codice: '068028', nome: 'Pescara', slug: 'pescara', provincia: '068', cap: '65100', popolazione: 118652 },

  // Bergamo
  { codice: '016024', nome: 'Bergamo', slug: 'bergamo', provincia: '016', cap: '24100', popolazione: 121639 },
];

// Helper functions
export function getRegione(slug: string): Regione | undefined {
  return regioni.find((r) => r.slug === slug);
}

export function getProvinceByRegione(regioneSlug: string): Provincia[] {
  const regione = getRegione(regioneSlug);
  if (!regione) return [];
  return province.filter((p) => p.regione === regione.codice);
}

export function getProvincia(slug: string): Provincia | undefined {
  return province.find((p) => p.slug === slug);
}

export function getComuniByProvincia(provinciaSlug: string): Comune[] {
  const prov = getProvincia(provinciaSlug);
  if (!prov) return [];
  return comuni.filter((c) => c.provincia === prov.codice);
}

export function getComune(slug: string): Comune | undefined {
  return comuni.find((c) => c.slug === slug);
}

export function getComuneWithContext(comuneSlug: string) {
  const comune = getComune(comuneSlug);
  if (!comune) return null;

  const prov = province.find((p) => p.codice === comune.provincia);
  if (!prov) return null;

  const reg = regioni.find((r) => r.codice === prov.regione);
  if (!reg) return null;

  return {
    comune,
    provincia: prov,
    regione: reg,
  };
}

// Slugify helper
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
