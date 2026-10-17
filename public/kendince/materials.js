// Composition is a source statement, never a whole-garment certification.
const norm=v=>String(v||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
const SYNTHETICS=[['Polyester',/polyester|poliester|poly[\/ -]cotton/],['Poliamid / naylon',/polyamide|poliamid|nylon|naylon/],['Akrilik',/acrylic|akrilik/],['Elastan',/elastane|elastan|spandex|lycra/],['Poliüretan',/polyurethane|poliuretan|\bpu\b/],['Suni deri',/suni deri|faux leather|synthetic leather/],['EVA',/\beva\b/],['PVC',/\bpvc\b|polyvinyl/],['Sentetik lif',/sentetik|synthetic|polypropylene|polipropilen|polyacryl|modacryl/]];
const NATURAL=/pamuk|cotton|keten|linen|\byun\b|wool|cashmere|kasmir|silk|ipek|hemp|kenevir|alpaca|mohair/;
const CELLULOSE=/viskoz|viscose|lyocell|tencel|modal|cupro|rayon|acetate|asetat/;
export function materialInfo(p){
 const raw=String(p.material||p.sourceFacts?.['Ana Kumaş İçeriği']||p.sourceFacts?.['Kumaş']||'').trim(),text=norm(raw),synthetics=SYNTHETICS.filter(([,re])=>re.test(text)).map(([name])=>name),percent=/%\s*\d|\d\s*%/.test(text);
 const unknown=!raw||/belirtilme|dogrulanama|kendi parcan|unknown|not specified/.test(text);
 const status=synthetics.length?'synthetic':unknown?'unknown':/deri|leather|suede|suet/.test(text)?'leather':CELLULOSE.test(text)?'cellulose':NATURAL.test(text)&&percent?'natural':'unknown';
 const label=status==='synthetic'?'Sentetik içerir':status==='natural'?'Doğal lif beyanı':status==='cellulose'?'Selülozik lif içerir':status==='leather'?'Deri beyanı':'İçerik / oran belirsiz';
 return {status,label,synthetics,composition:unknown?'Kumaş bileşimi doğrulanamadı':raw,note:status==='synthetic'?synthetics.join(' · '):status==='natural'?'Beyan edilen bileşenler; astar, dolgu ve aksesuarların tamamı doğrulanmış sayılmaz.':status==='leather'?'Deri beyanı astar, taban ve kaplama bileşenlerini tek başına doğrulamaz.':status==='cellulose'?'Viskoz, lyocell, modal ve cupro gibi lifler rejenere selüloz esaslıdır. Diğer bileşenleri ayrıca kontrol et.':'İsim, doku veya ürün fotoğrafından lif oranı çıkarılmaz.'};
}
