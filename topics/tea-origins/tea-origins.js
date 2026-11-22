(() => {
  'use strict';
  const form = document.getElementById('tea-filters');
  if (!form) return;
  const search = document.getElementById('tea-search');
  const brand = document.getElementById('tea-brand');
  const country = document.getElementById('tea-country');
  const mingjian = document.getElementById('only-mingjian');
  const result = document.getElementById('filter-result');
  const empty = document.getElementById('no-results');
  const rows = [...document.querySelectorAll('.tea-row')];
  const sections = [...document.querySelectorAll('.brand-section')];
  const normalize = value => value.toLowerCase().replace(/臺/g, '台').trim();
  function filter() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const row of rows) {
      const data = row.dataset;
      const text = normalize(data.search || '');
      const show = terms.every(term => text.includes(term)) &&
        (!brand.value || data.brand === brand.value) &&
        (!country.value || (data.countries || '').split('|').includes(country.value)) &&
        (!mingjian.checked || data.mingjian === 'true');
      row.hidden = !show;
      if (show) visible++;
    }
    let brandCount = 0;
    for (const section of sections) {
      const count = [...section.querySelectorAll('.tea-row')].filter(row => !row.hidden).length;
      section.hidden = count === 0;
      section.querySelector('[data-brand-count]').textContent = String(count);
      if (count) brandCount++;
    }
    empty.hidden = visible !== 0;
    result.textContent = `顯示 ${brandCount} 個品牌・${visible} / ${rows.length} 筆記錄`;
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => requestAnimationFrame(filter));
  for (const link of document.querySelectorAll('[data-country-link]')) {
    link.addEventListener('click', () => {
      // The country links keep working as ordinary in-page links without JS.
      search.value = '';
      brand.value = '';
      mingjian.checked = false;
      country.value = link.dataset.countryLink;
      filter();
    });
  }
  form.hidden = false;
  filter();
})();
