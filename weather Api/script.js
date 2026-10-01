const $ = (id) => document.getElementById(id);

const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};

const save = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );

let units = load('wx-units', 'metric');
let theme = load('wx-theme', null);
let saved = load('wx-saved', []);
let loc = load('wx-loc', null);
let ctrl = null;
let lastData = null;

// Weather codes
const WMO = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Heavy showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm, hail',
  99: 'Severe thunderstorm, hail',
};

// Weather icons
function icon(c, day = 1) {
  if (c <= 1) return day ? '☀️' : '🌙';
  if (c === 2) return day ? '⛅' : '☁️';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c)) return '🌧️';
  if ([71, 73, 75].includes(c)) return '❄️';
  if (c >= 95) return '⛈️';
  return '🌡️';
}

const deg = (n) => `${Math.round(n)}°`;

const clock = (t) => {
  const h = +t.slice(11, 13);
  const m = t.slice(14, 16);

  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

const key = (l) => `${l.lat.toFixed(2)},${l.lon.toFixed(2)}`;

const setStatus = (m) => ($('status').textContent = m);

/* ---------- Theme & Units ---------- */

function applyTheme() {
  document.documentElement.dataset.theme =
    theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

$('theme').onclick = () => {
  theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

  save('wx-theme', theme);
  applyTheme();
};

function applyUnits() {
  $('metric').setAttribute('aria-pressed', units === 'metric');
  $('imperial').setAttribute('aria-pressed', units === 'imperial');
}

['metric', 'imperial'].forEach(
  (u) =>
    ($(u).onclick = () => {
      units = u;
      save('wx-units', u);
      applyUnits();
      fetchWeather();
    }),
);

/* ---------- Saved Places ---------- */

function renderSaved() {
  $('saved-empty').hidden = saved.length > 0;

  $('saved').innerHTML = saved
    .map(
      (s, i) =>
        `<li class="${loc && key(loc) === key(s) ? 'on' : ''}">
          <button class="pick" data-i="${i}">
            ${esc(s.name)}
          </button>

          <button
            class="del"
            data-d="${i}"
            aria-label="Remove ${esc(s.name)}"
          >
            ✕
          </button>
        </li>`,
    )
    .join('');

  const on = loc && saved.some((s) => key(s) === key(loc));

  $('star').textContent = on ? '★' : '☆';
  $('star').setAttribute('aria-pressed', !!on);
}

$('saved').onclick = (e) => {
  const p = e.target.closest('[data-i]');
  const d = e.target.closest('[data-d]');

  if (p) {
    setLoc(saved[+p.dataset.i]);
  }

  if (d) {
    saved.splice(+d.dataset.d, 1);
    save('wx-saved', saved);
    renderSaved();
  }
};

$('star').onclick = () => {
  if (!loc) return;

  const i = saved.findIndex((s) => key(s) === key(loc));

  i >= 0 ? saved.splice(i, 1) : saved.push(loc);

  save('wx-saved', saved);
  renderSaved();
};

/* ---------- Search ---------- */

let timer;
let results = [];
let active = -1;

function closeSuggest() {
  $('suggest').hidden = true;
  $('q').setAttribute('aria-expanded', 'false');
  active = -1;
}

async function searchCities(q) {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      q,
    )}&count=6`,
  );

  return ((await r.json()).results || []).map((p) => ({
    lat: p.latitude,
    lon: p.longitude,
    name: p.name,
    sub: [p.admin1, p.country].filter(Boolean).join(', '),
  }));
}

$('q').addEventListener('input', () => {
  clearTimeout(timer);

  const q = $('q').value.trim();

  if (q.length < 2) return closeSuggest();

  timer = setTimeout(async () => {
    try {
      results = await searchCities(q);

      $('suggest').innerHTML = results.length
        ? results
            .map(
              (r, i) =>
                `<li>
                  <button data-r="${i}">
                    ${esc(r.name)}
                    <span>${esc(r.sub)}</span>
                  </button>
                </li>`,
            )
            .join('')
        : `<li style="padding:10px" class="muted">
             No matches. Check the spelling.
           </li>`;

      $('suggest').hidden = false;
      $('q').setAttribute('aria-expanded', 'true');
      active = -1;
    } catch {
      closeSuggest();
    }
  }, 250);
});

$('q').addEventListener('keydown', (e) => {
  const items = [...$('suggest').querySelectorAll('button')];

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();

    if (!items.length) return;

    active =
      (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;

    items.forEach((b, i) => b.classList.toggle('on', i === active));
  } else if (e.key === 'Enter') {
    e.preventDefault();

    if (results.length) {
      pick(results[Math.max(active, 0)]);
    } else {
      submitText();
    }
  } else if (e.key === 'Escape') {
    closeSuggest();
  }
});

$('suggest').onclick = (e) => {
  const b = e.target.closest('[data-r]');

  if (b) {
    pick(results[+b.dataset.r]);
  }
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) {
    closeSuggest();
  }
});

async function submitText() {
  const q = $('q').value.trim();

  if (!q) return;

  setStatus('Searching…');

  try {
    const r = await searchCities(q);

    r.length
      ? pick(r[0])
      : setStatus(
          `No city found for "${q}". Check the spelling and try again.`,
        );
  } catch {
    setStatus('Search failed. Check your connection and try again.');
  }
}

function pick(r) {
  $('q').value = '';
  results = [];
  closeSuggest();
  setLoc(r);
}

document.querySelectorAll('.chips button').forEach(
  (b) =>
    (b.onclick = () => {
      $('q').value = b.dataset.city;
      submitText();
    }),
);

/* ---------- Location ---------- */

$('locate').onclick = () => {
  if (!navigator.geolocation) {
    return setStatus("Your browser doesn't support location.");
  }

  setStatus('Finding your location…');

  navigator.geolocation.getCurrentPosition(
    (p) =>
      setLoc({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        name: 'Your location',
        sub: '',
      }),
    () =>
      setStatus(
        'Location access was blocked. Allow it in your browser, or search by city.',
      ),
  );
};

$('refresh').onclick = () => fetchWeather();

/* ---------- Weather ---------- */

function setLoc(l) {
  loc = l;

  save('wx-loc', l);

  renderSaved();

  fetchWeather();
}

async function fetchWeather() {
  if (!loc) return;

  ctrl?.abort();

  ctrl = new AbortController();

  setStatus('Loading forecast…');

  const im = units === 'imperial';

  const params = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    timezone: 'auto',
    forecast_days: 7,

    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,pressure_msl',

    // Only UV and visibility are needed now.
    hourly: 'uv_index,visibility',

    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum',

    temperature_unit: im ? 'fahrenheit' : 'celsius',

    wind_speed_unit: im ? 'mph' : 'kmh',

    precipitation_unit: im ? 'inch' : 'mm',
  });

  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: ctrl.signal,
    });

    if (!r.ok) {
      throw new Error(
        'The weather service is unavailable. Try again in a moment.',
      );
    }

    lastData = await r.json();

    render(lastData);

    setStatus('');
  } catch (e) {
    if (e.name !== 'AbortError') {
      setStatus(e.message || "Couldn't load weather. Check your connection.");
    }
  }
}

/* ---------- Helpers ---------- */

const uvLabel = (u) =>
  u < 3
    ? 'Low'
    : u < 6
      ? 'Moderate'
      : u < 8
        ? 'High'
        : u < 11
          ? 'Very high'
          : 'Extreme';

const compass = (d) =>
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];

/* ---------- Render Weather ---------- */

function render(d) {
  const c = d.current;
  const im = units === 'imperial';
  const D = d.daily;
  const H = d.hourly;

  $('now').toggleAttribute('data-night', !c.is_day);

  $('place').textContent = loc.sub
    ? `${loc.name}, ${loc.sub.split(', ').pop()}`
    : loc.name;

  const local = new Date(Date.now() + d.utc_offset_seconds * 1000);

  $('local').textContent =
    'Local time ' +
    local.toLocaleString([], {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    });

  $('temp').textContent = deg(c.temperature_2m);

  $('icon').textContent = icon(c.weather_code, c.is_day);

  $('cond').textContent = WMO[c.weather_code] || 'Unknown';

  $('hilo').textContent = `High ${deg(D.temperature_2m_max[0])} · Low ${deg(
    D.temperature_2m_min[0],
  )}`;

  /* ---------- Conditions ---------- */

  const diff = c.apparent_temperature - c.temperature_2m;

  const hum = c.relative_humidity_2m;

  const uv = H.uv_index[0] ?? 0;

  const vis = (H.visibility[0] ?? 0) / 1000;

  const pr = c.pressure_msl;

  const tile = (l, v, s) =>
    `<div class="tile">
      <div class="l">${l}</div>
      <div class="v">${v}</div>
      <div class="s">${s}</div>
    </div>`;

  $('tiles').innerHTML = [
    tile(
      'Feels like',
      deg(c.apparent_temperature),
      Math.abs(diff) < 1.5
        ? 'Similar to actual'
        : diff > 0
          ? 'Warmer than actual'
          : 'Colder than actual',
    ),

    tile(
      'Humidity',
      hum + '%',
      hum < 30 ? 'Dry' : hum < 60 ? 'Comfortable' : 'Humid',
    ),

    tile(
      'Wind',
      `${Math.round(c.wind_speed_10m)} ${im ? 'mph' : 'km/h'}`,
      `From ${compass(c.wind_direction_10m)}`,
    ),

    tile(
      'Pressure',
      im ? (pr * 0.02953).toFixed(2) + ' inHg' : Math.round(pr) + ' hPa',
      pr < 1009 ? 'Low' : pr > 1022 ? 'High' : 'Normal',
    ),

    tile('UV index', Math.round(uv), uvLabel(uv)),

    tile(
      'Chance of rain',
      (D.precipitation_probability_max[0] ?? 0) + '%',
      `${D.precipitation_sum[0] ?? 0} ${im ? 'in' : 'mm'} expected today`,
    ),

    tile(
      'Visibility',
      im ? (vis * 0.6214).toFixed(1) + ' mi' : vis.toFixed(1) + ' km',
      vis >= 10 ? 'Clear view' : vis >= 4 ? 'Reduced' : 'Poor',
    ),

    tile('Sun', '↑ ' + clock(D.sunrise[0]), '↓ Sunset ' + clock(D.sunset[0])),
  ].join('');

  /* ---------- 7 Day Forecast ---------- */

  const hi = D.temperature_2m_max;
  const lo = D.temperature_2m_min;

  const min = Math.min(...lo);

  const span = Math.max(...hi) - min || 1;

  $('daily').innerHTML = D.time
    .map((t, i) => {
      const name =
        i === 0
          ? 'Today'
          : new Date(t + 'T00:00').toLocaleDateString([], {
              weekday: 'short',
            });

      const left = ((lo[i] - min) / span) * 100;

      const w = Math.min(
        Math.max(((hi[i] - lo[i]) / span) * 100, 8),
        100 - left,
      );

      const p = D.precipitation_probability_max[i];

      return `
        <div class="dy">
          <span class="n">${name}</span>

          <span
            title="${esc(WMO[D.weather_code[i]] || '')}"
          >
            ${icon(D.weather_code[i])}
          </span>

          <span class="r">
            ${p >= 20 ? p + '%' : ''}
          </span>

          <span class="lo">
            ${deg(lo[i])}
          </span>

          <div class="trk">
            <div
              class="fil"
              style="left:${left}%;width:${w}%"
            ></div>
          </div>

          <span class="hi">
            ${deg(hi[i])}
          </span>
        </div>
      `;
    })
    .join('');

  /* ---------- Updated ---------- */

  $('updated').textContent =
    'Updated ' +
    new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }) +
    ' · Data from Open-Meteo';

  $('content').hidden = false;

  renderSaved();

  renderSaved();
}

/* ---------- Start ---------- */

applyTheme();

applyUnits();

renderSaved();

if (loc) {
  fetchWeather();
}

setInterval(
  () => {
    if (loc && !document.hidden) {
      fetchWeather();
    }
  },
  10 * 60 * 1000,
);
