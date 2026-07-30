/**
 * 경찰청 공공데이터 - 2024년 전국 경찰서 및 대한민국 지도 클릭 연동 메인 앱
 */

let currentFilteredStations = [];
let activeCodeTab = 'tab-rate';
let aggregatedRegionStats = {};
let selectedRegionKey = '서울';
let currentMetric = 'rate';

// 페이지 로드 및 깃허브 페이지(GitHub Pages) 등 정적 서버 대응 초기화
function initApp() {
  try {
    aggregatedRegionStats = getAggregatedRegionStats('rate');
    initSummaryKPI();
    renderSouthKoreaSvgMap();
    selectRegionOnMap('서울');
    populatePresets();
    loadStationPreset(0);
    switchCodeTab('tab-rate');
    handleFilterChange();
  } catch (e) {
    console.error('App initialization error:', e);
  }
}

// DOM 상태에 따라 즉시 실행 또는 이벤트 대기 (GitHub Pages 호환)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
} else {
  document.addEventListener('DOMContentLoaded', initApp);
}

// 윈도우 렌더링 완료 시 지도 보장 재렌더링
window.addEventListener('load', () => {
  if (typeof KOREA_REGION_MAP_DATA !== 'undefined') {
    renderSouthKoreaSvgMap();
  }
});

// 지도 평가 지표 스위치 (10만명당 발생률 vs 총 범죄 발생건수)
function switchMapMetric(mode) {
  currentMetric = mode;
  setMapMetricMode(mode);

  document.getElementById('metric-btn-rate').classList.toggle('active', mode === 'rate');
  document.getElementById('metric-btn-volume').classList.toggle('active', mode === 'volume');

  aggregatedRegionStats = getAggregatedRegionStats(mode);
  renderSouthKoreaSvgMap();
  selectRegionOnMap(selectedRegionKey);
}

// 안전한 데이터셋 및 유틸리티 객체 게터 (글로벌 바인딩 보장)
function getDataset() {
  if (typeof window !== 'undefined' && window.PROCESSED_POLICE_DATASET) {
    return window.PROCESSED_POLICE_DATASET;
  }
  if (typeof PROCESSED_POLICE_DATASET !== 'undefined') {
    return PROCESSED_POLICE_DATASET;
  }
  return [];
}

function getUtils() {
  if (typeof window !== 'undefined' && window.PoliceCrimeUtils) {
    return window.PoliceCrimeUtils;
  }
  if (typeof PoliceCrimeUtils !== 'undefined') {
    return PoliceCrimeUtils;
  }
  return null;
}

// 1. KPI 통계 카드 초기화
function initSummaryKPI() {
  const Utils = getUtils();
  const dataset = getDataset();
  if (!Utils || !dataset.length) return;

  const summary = Utils.getCrimeSummary(dataset);

  const elemStations = document.getElementById('kpi-total-stations');
  const elemPop = document.getElementById('kpi-total-pop');
  const elemRate = document.getElementById('kpi-avg-rate');
  const elemOccur = document.getElementById('kpi-total-occurrences');
  const elemArrest = document.getElementById('kpi-avg-arrest');
  const elemArrestCount = document.getElementById('kpi-total-arrests');
  const elemHighStation = document.getElementById('kpi-highest-station');
  const elemHighRate = document.getElementById('kpi-highest-rate');

  if (elemStations) elemStations.textContent = `${summary.totalStations}개`;
  if (elemPop) elemPop.textContent = summary.totalPopulation.toLocaleString();
  if (elemRate) elemRate.textContent = `${summary.avgRatePer100k} 건/10만명`;
  if (elemOccur) elemOccur.textContent = summary.totalOccurrences.toLocaleString();
  if (elemArrest) elemArrest.textContent = `${summary.avgArrestRate}%`;
  if (elemArrestCount) elemArrestCount.textContent = summary.totalArrests.toLocaleString();

  if (summary.highestStation) {
    if (elemHighStation) elemHighStation.textContent = summary.highestStation.stationName;
    if (elemHighRate) elemHighRate.textContent = summary.highestStation.ratePer100k.toLocaleString();
  }
}

// 2. 대한민국 SVG 벡터 지도 렌더링
function renderSouthKoreaSvgMap() {
  const svg = document.getElementById('south-korea-svg');
  if (!svg) return;

  let svgContent = '';

  const renderKeys = typeof REGION_RENDER_ORDER !== 'undefined' 
    ? REGION_RENDER_ORDER 
    : Object.keys(KOREA_REGION_MAP_DATA);

  renderKeys.forEach(key => {
    const reg = KOREA_REGION_MAP_DATA[key];
    const stats = aggregatedRegionStats[key] || { ratePer100k: 0, riskGrade: { color: '#6366f1' } };

    let fillColor = stats.riskGrade ? stats.riskGrade.color : '#6366f1';

    svgContent += `
      <g 
        id="map-group-${key}" 
        class="map-region-group" 
        onclick="selectRegionOnMap('${key}')"
        onmousemove="showMapTooltip(event, '${key}')"
        onmouseout="hideMapTooltip()"
      >
        <path 
          id="map-path-${key}" 
          class="map-region-path" 
          d="${reg.svgPath}" 
          fill="${fillColor}" 
          fill-opacity="0.85"
        />
        <text 
          x="${reg.labelPos.x}" 
          y="${reg.labelPos.y}" 
          class="map-region-text"
        >${reg.shortName}</text>
      </g>
    `;
  });

  svg.innerHTML = svgContent;
}

// 3. 지도 호버 툴팁 표시
function showMapTooltip(event, key) {
  const tooltip = document.getElementById('map-tooltip');
  const stats = aggregatedRegionStats[key];
  if (!stats || !tooltip) return;

  const wrapperRect = document.querySelector('.svg-map-wrapper').getBoundingClientRect();

  tooltip.innerHTML = `
    <div style="font-weight:700; color:#fff;">${stats.name}</div>
    <div style="font-size:0.78rem; margin-top:2px;">
      10만명당 발생률: <b style="color:var(--accent-secondary);">${stats.ratePer100k}건</b>
    </div>
    <div style="font-size:0.78rem;">
      총 발생건수: <b style="color:#fff;">${stats.totalOccurrences.toLocaleString()}건</b>
    </div>
    <div style="font-size:0.78rem;">
      평가 등급: <span style="color:${stats.riskGrade.color}; font-weight:700;">${stats.riskGrade.label}</span>
    </div>
  `;

  // 동쪽 해안가 지역(울산, 부산, 경북)은 툴팁 설명 박스를 커서의 왼쪽에 배치하여 세로로 길쭉해지거나 경계 밖으로 벗어나는 것 방지
  const isEastRegion = ['울산', '부산', '경북'].includes(key);
  if (isEastRegion) {
    tooltip.style.left = `${event.clientX - wrapperRect.left - 15}px`;
    tooltip.style.transform = 'translateX(-100%)';
  } else {
    tooltip.style.left = `${event.clientX - wrapperRect.left + 15}px`;
    tooltip.style.transform = 'none';
  }

  tooltip.style.top = `${event.clientY - wrapperRect.top - 20}px`;
  tooltip.classList.add('show');
}

function hideMapTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.classList.remove('show');
}

// 4. 지도에서 지역 클릭 시 이벤트 처리
function selectRegionOnMap(key) {
  selectedRegionKey = key;
  const stats = aggregatedRegionStats[key];
  if (!stats) return;

  document.querySelectorAll('.map-region-group').forEach(g => g.classList.remove('active'));
  const activeGroup = document.getElementById(`map-group-${key}`);
  if (activeGroup) activeGroup.classList.add('active');

  const drawer = document.getElementById('map-detail-drawer');

  const elemId = document.getElementById('drawer-region-id');
  const elemName = document.getElementById('drawer-region-name');
  const elemBadge = document.getElementById('drawer-risk-badge');
  const elemRate = document.getElementById('drawer-rate-100k');
  const elemArrest = document.getElementById('drawer-arrest-rate');

  if (elemId) elemId.textContent = stats.id || key;
  if (elemName) elemName.textContent = stats.name;

  if (elemBadge) {
    elemBadge.innerHTML = `<span class="badge ${stats.riskGrade.badgeClass}">${stats.riskGrade.label}</span>`;
  }

  if (elemRate) elemRate.textContent = `${stats.ratePer100k} 건/10만명`;
  if (elemArrest) elemArrest.textContent = `${stats.arrestRate}%`;

  // 1. 관할 인구 및 발생 건수 영역 자동 복구/업데이트
  let elemPopOccur = document.getElementById('drawer-pop-occurrences');
  if (!elemPopOccur && drawer) {
    const popBox = document.createElement('div');
    popBox.style.marginTop = '16px';
    popBox.innerHTML = `
      <div class="modal-info-label">관할 총 인구수 및 발생 건수</div>
      <div style="font-size:0.95rem; font-weight:600; color:#fff; margin-top:2px;" id="drawer-pop-occurrences"></div>
    `;
    drawer.appendChild(popBox);
    elemPopOccur = document.getElementById('drawer-pop-occurrences');
  }
  if (elemPopOccur) {
    elemPopOccur.textContent = `관할 인구 ${stats.totalPopulation.toLocaleString()}명 | 총 강력범죄 ${stats.totalOccurrences.toLocaleString()}건 발생 (${stats.totalArrests.toLocaleString()}건 검거)`;
  }

  // 2. 5대 강력범죄 세부 비중 영역 자동 복구/업데이트
  let barsContainer = document.getElementById('drawer-crime-bars');
  if (!barsContainer && drawer) {
    const barsSection = document.createElement('div');
    barsSection.style.marginTop = '20px';
    barsSection.innerHTML = `
      <h4 style="font-size:0.9rem; margin-bottom:10px; color:var(--text-muted);">5대 강력범죄 세부 비중 및 발생 건수</h4>
      <div id="drawer-crime-bars" class="drawer-crime-bars"></div>
    `;
    drawer.appendChild(barsSection);
    barsContainer = document.getElementById('drawer-crime-bars');
  }

  const total5 = Object.values(stats.breakdown).reduce((a, b) => a + b, 0) || 1;
  const breakdownLabels = { murder: '살인', robbery: '강도', sexualAssault: '강간·추행', theft: '절도', violence: '폭력' };

  if (barsContainer) {
    barsContainer.innerHTML = Object.keys(stats.breakdown).map(type => {
      const count = stats.breakdown[type];
      const pct = Math.min(100, Math.round((count / total5) * 100));
      return `
        <div class="drawer-crime-row">
          <span style="color:var(--text-muted); font-weight:600;">${breakdownLabels[type] || type}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;"></div>
          </div>
          <span style="font-family:var(--font-mono); text-align:right; font-weight:700;">${count.toLocaleString()}건 (${pct}%)</span>
        </div>
      `;
    }).join('');
  }

  // 3. 소속 경찰서별 랭킹 영역 자동 복구/업데이트
  let listContainer = document.getElementById('drawer-stations-list');
  if (!listContainer && drawer) {
    const listSection = document.createElement('div');
    listSection.style.marginTop = '20px';
    listSection.innerHTML = `
      <h4 style="font-size:0.9rem; margin-bottom:10px; color:var(--text-muted);">소속 경찰서별 발생률 랭킹</h4>
      <div id="drawer-stations-list" class="drawer-stations-list"></div>
    `;
    drawer.appendChild(listSection);
    listContainer = document.getElementById('drawer-stations-list');
  }

  if (listContainer) {
    const dataset = getDataset();
    if (!stats.stations || !stats.stations.length) {
      listContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted);">해당 지역 소속 경찰서 상세 데이터 준비 중</div>`;
    } else {
      listContainer.innerHTML = stats.stations.map((st, idx) => {
        const stIdx = dataset.findIndex(s => s.stationName === st.stationName);
        return `
          <div class="station-rank-card" onclick="selectStationByPresetIndex(${stIdx})" style="cursor:pointer;" title="시뮬레이터로 데이터 로드">
            <div>
              <b style="color:#fff;">${idx + 1}. ${st.stationName}</b>
              <span class="calc-res-label" style="font-size:0.75rem; margin-left:6px;">인구 ${st.population.toLocaleString()}명</span>
            </div>
            <div>
              <span style="color:var(--accent-secondary); font-family:var(--font-mono); font-weight:700;">${st.ratePer100k}</span>
              <span class="calc-res-label" style="font-size:0.75rem;">건/10만명</span>
            </div>
          </div>
        `;
      }).join('');

      if (stats.stations[0]) {
        const topIdx = dataset.findIndex(s => s.stationName === stats.stations[0].stationName);
        if (topIdx !== -1) {
          const select = document.getElementById('station-preset-select');
          if (select) select.value = topIdx;
          loadStationPreset(topIdx);
        }
      }
    }
  }
}

// 5. 시뮬레이터로 경찰서 선택 동기화
function selectStationByPresetIndex(index) {
  const dataset = getDataset();
  if (index < 0 || index >= dataset.length) return;
  const select = document.getElementById('station-preset-select');
  if (select) select.value = index;
  loadStationPreset(index);
  scrollToElement('playground-section');
}

// 7. 플레이그라운드 프리셋 목록 구성
function populatePresets() {
  const select = document.getElementById('station-preset-select');
  if (!select) return;
  select.innerHTML = '';

  const dataset = getDataset();
  dataset.forEach((st, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    option.textContent = `[${st.agencyRegion}] ${st.stationName} (인구: ${st.population.toLocaleString()}명, 발생: ${st.occurrences.toLocaleString()}건)`;
    select.appendChild(option);
  });
}

// 8. 선택 경찰서의 공식 통계 데이터 로드
function loadStationPreset(index) {
  if (index === '' || index === undefined) return;
  const dataset = getDataset();
  const st = dataset[index];
  if (!st) return;

  const elemPop = document.getElementById('input-population');
  const elemOccur = document.getElementById('input-occurrences');
  const elemArrst = document.getElementById('input-arrests');

  const elemM = document.getElementById('input-murder');
  const elemR = document.getElementById('input-robbery');
  const elemS = document.getElementById('input-sex');
  const elemT = document.getElementById('input-theft');
  const elemV = document.getElementById('input-violence');

  if (elemPop) elemPop.value = st.population;
  if (elemOccur) elemOccur.value = st.occurrences;
  if (elemArrst) elemArrst.value = st.arrests;

  if (elemM) elemM.value = st.breakdown.murder;
  if (elemR) elemR.value = st.breakdown.robbery;
  if (elemS) elemS.value = st.breakdown.sexualAssault;
  if (elemT) elemT.value = st.breakdown.theft;
  if (elemV) elemV.value = st.breakdown.violence;

  runLiveCalculation();
}

// 9. 공식 수치 기반 수식 계산 결과 표출
function runLiveCalculation() {
  const elemPop = document.getElementById('input-population');
  const elemOccur = document.getElementById('input-occurrences');
  const elemArrst = document.getElementById('input-arrests');

  const population = Number(elemPop ? elemPop.value : 0) || 0;
  const occurrences = Number(elemOccur ? elemOccur.value : 0) || 0;
  const arrests = Number(elemArrst ? elemArrst.value : 0) || 0;

  const elemM = document.getElementById('input-murder');
  const elemR = document.getElementById('input-robbery');
  const elemS = document.getElementById('input-sex');
  const elemT = document.getElementById('input-theft');
  const elemV = document.getElementById('input-violence');

  const breakdown = {
    murder: Number(elemM ? elemM.value : 0) || 0,
    robbery: Number(elemR ? elemR.value : 0) || 0,
    sexualAssault: Number(elemS ? elemS.value : 0) || 0,
    theft: Number(elemT ? elemT.value : 0) || 0,
    violence: Number(elemV ? elemV.value : 0) || 0
  };

  const Utils = getUtils();
  if (!Utils) return;

  const rate100k = Utils.calculateCrimeRate100k(occurrences, population);
  const arrestRate = Utils.calculateArrestRate(occurrences, arrests);
  const riskIndex = Utils.calculateRiskIndex(breakdown, population);
  const riskGrade = Utils.getRiskGrade(riskIndex);

  const resRate = document.getElementById('res-rate-100k');
  const resArrest = document.getElementById('res-arrest-rate');
  const resRisk = document.getElementById('res-risk-index');
  const resBadge = document.getElementById('res-risk-grade-badge');

  if (resRate) resRate.textContent = `${rate100k} 건/10만명`;
  if (resArrest) resArrest.textContent = `${arrestRate}%`;
  if (resRisk) resRisk.textContent = `${riskIndex} 점`;
  if (resBadge) resBadge.innerHTML = `<span class="badge ${riskGrade.badgeClass}">${riskGrade.label} (${riskGrade.grade}등급)</span>`;

  const liveCode = `// 1. 관할 인구 10만 명당 강력범죄 발생률 계산 수식
function calculateCrimeRate100k(totalCrimes, population) {
  if (!population || population <= 0) return 0;
  return Number(((totalCrimes / population) * 100000).toFixed(2));
}

// 2. 강력범죄 검거율 계산 수식
function calculateArrestRate(totalCrimes, totalArrests) {
  if (!totalCrimes || totalCrimes <= 0) return 0;
  return Number(((totalArrests / totalCrimes) * 100).toFixed(1));
}

// --- [선택된 경찰서 공식 수치 시뮬레이션] ---
const population = ${population};   // 관할인구수
const occurrences = ${occurrences};  // 강력범죄 발생건수
const arrests = ${arrests};      // 강력범죄 검거건수

const crimeRate100k = calculateCrimeRate100k(${occurrences}, ${population}); // ${rate100k} 건/10만명
const arrestRate = calculateArrestRate(${occurrences}, ${arrests});           // ${arrestRate}%`;

  const liveElem = document.getElementById('live-js-code');
  if (liveElem) liveElem.textContent = liveCode;
}

// 10. 코드 갤러리 탭 전환
function switchCodeTab(tabId) {
  activeCodeTab = tabId;
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  let filename = '';
  let codeSnippet = '';

  if (tabId === 'tab-rate') {
    filename = 'calculateCrimeRate.js';
    codeSnippet = `/**
 * 경찰청 공공데이터 - 10만 명당 강력범죄 발생률 및 검거율 계산 자바스크립트 함수
 */
function calculateCrimeRate100k(totalCrimes, population, decimals = 2) {
  if (!population || population <= 0) return 0;
  const rate = (totalCrimes / population) * 100000;
  return Number(rate.toFixed(decimals));
}

function calculateArrestRate(totalCrimes, totalArrests, decimals = 1) {
  if (!totalCrimes || totalCrimes <= 0) return 0;
  const rate = (totalArrests / totalCrimes) * 100;
  return Number(rate.toFixed(decimals));
}`;
  } else if (tabId === 'tab-openapi') {
    filename = 'fetchPoliceCrimeApi.js';
    codeSnippet = `/**
 * 공공데이터포털(data.go.kr) 경찰청_전국 경찰서별 강력범죄 발생 현황 OpenAPI 비동기 호출
 */
async function fetchPoliceCrimeApi(serviceKey, pageNo = 1, numOfRows = 50) {
  const baseUrl = 'https://apis.data.go.kr/1320000/PoliceStationCrimeStatsService/getCrimeStats';
  const url = \`\${baseUrl}?serviceKey=\${encodeURIComponent(serviceKey)}&pageNo=\${pageNo}&numOfRows=\${numOfRows}&type=json\`;

  const response = await fetch(url);
  const data = await response.json();
  const items = data?.response?.body?.items?.item || [];

  return items.map(item => ({
    stationName: item.sttnNm,
    occurrences: Number(item.occrCnt || 0),
    population: Number(item.popltn || 100000),
    arrests: Number(item.arrstCnt || 0),
    ratePer100k: calculateCrimeRate100k(Number(item.occrCnt || 0), Number(item.popltn || 100000))
  }));
}`;
  } else if (tabId === 'tab-map') {
    filename = 'koreaMapClickEventHandler.js';
    codeSnippet = `/**
 * 대한민국 지도 SVG 패스 클릭 이벤트 바인딩 및 범죄율 출력 연동 코드
 */
document.querySelectorAll('.map-region-group').forEach(group => {
  group.addEventListener('click', (e) => {
    const groupId = group.getAttribute('id');
    const regionKey = groupId.replace('map-group-', '');
    const stats = aggregatedRegionStats[regionKey];

    if (stats) {
      console.log(\`[\${stats.name}] 10만명당 발생률: \${stats.ratePer100k}건, 총 발생: \${stats.totalOccurrences}건\`);
      updateRegionDrawerUI(stats);
    }
  });
});`;
  } else if (tabId === 'tab-risk') {
    filename = 'calculateRiskIndex.js';
    codeSnippet = `/**
 * 5대 강력범죄 가중 심각도 반영 위험도 지수 산출 자바스크립트 함수
 */
function calculateRiskIndex(breakdown = {}, population = 100000) {
  if (!population || population <= 0) return 0;
  const weights = { murder: 50, robbery: 30, sexualAssault: 20, theft: 5, violence: 10 };
  const weightedSum =
    (breakdown.murder || 0) * weights.murder +
    (breakdown.robbery || 0) * weights.robbery +
    (breakdown.sexualAssault || 0) * weights.sexualAssault +
    (breakdown.theft || 0) * weights.theft +
    (breakdown.violence || 0) * weights.violence;

  const weightedRatePer100k = (weightedSum / population) * 100000;
  return Math.min(100, Math.max(0, Math.round(weightedRatePer100k / 80)));
}`;
  } else if (tabId === 'tab-filter') {
    filename = 'filterAndSortPoliceStations.js';
    codeSnippet = `/**
 * 경찰서 데이터 지역 필터, 검색 및 다중 조건 정렬 함수
 */
function filterAndSortPoliceStations(stationList = [], region = '전체', keyword = '', sortBy = 'rateDesc') {
  let result = stationList.filter(st => {
    if (region !== '전체' && st.agencyRegion !== region) return false;
    if (keyword.trim() !== '') {
      const kw = keyword.toLowerCase();
      if (!st.stationName.toLowerCase().includes(kw) && !st.agencyRegion.toLowerCase().includes(kw)) return false;
    }
    return true;
  });

  result.sort((a, b) => {
    if (sortBy === 'rateDesc') return b.ratePer100k - a.ratePer100k;
    if (sortBy === 'rateAsc') return a.ratePer100k - b.ratePer100k;
    if (sortBy === 'occurDesc') return b.occurrences - a.occurrences;
    if (sortBy === 'arrestDesc') return b.arrestRate - a.arrestRate;
    return 0;
  });

  return result;
}`;
  }

  const activeBtn = document.querySelector(`.tab-btn[onclick="switchCodeTab('${tabId}')"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const fnElem = document.getElementById('tab-code-filename');
  if (fnElem) fnElem.textContent = filename;
  const dispElem = document.getElementById('gallery-code-display');
  if (dispElem) dispElem.textContent = codeSnippet;
}

// 11. 필터링 & 정렬 & 테이블 / 차트 업데이트
function handleFilterChange() {
  const searchInput = document.getElementById('search-input');
  const regionSelect = document.getElementById('region-select');
  const sortSelect = document.getElementById('sort-select');

  const searchKeyword = searchInput ? searchInput.value : '';
  const region = regionSelect ? regionSelect.value : '전체';
  const sortBy = sortSelect ? sortSelect.value : 'rateDesc';

  const Utils = getUtils();
  const dataset = getDataset();

  if (Utils && dataset.length) {
    currentFilteredStations = Utils.filterAndSortStations(dataset, {
      region,
      searchKeyword,
      sortBy
    });
  } else {
    currentFilteredStations = dataset;
  }

  renderTable(currentFilteredStations);
  renderCharts();
}

function renderTable(stationList) {
  const tbody = document.getElementById('police-table-body');
  const countInfo = document.getElementById('table-count-info');
  if (countInfo) countInfo.textContent = `총 ${stationList.length}개 경찰서 표시 중`;

  if (!tbody) return;

  if (!stationList.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 30px; color: var(--text-muted);">검색 조건에 해당하는 경찰서 데이터가 없습니다.</td></tr>`;
    return;
  }

  const dataset = getDataset();

  tbody.innerHTML = stationList.map(st => {
    const stIdx = dataset.findIndex(s => s.stationName === st.stationName);
    return `
      <tr onclick="selectStationByPresetIndex(${stIdx})">
        <td><span class="badge" style="background: rgba(255,255,255,0.06); color:#cbd5e1;">${st.agencyRegion}</span></td>
        <td style="font-weight:700;">${st.stationName}</td>
        <td class="num-cell">${st.population.toLocaleString()}명</td>
        <td class="num-cell">${st.occurrences.toLocaleString()}건</td>
        <td class="num-cell" style="color:var(--accent-secondary); font-size:0.95rem;">${st.ratePer100k.toLocaleString()}</td>
        <td class="num-cell">${st.arrests.toLocaleString()}건</td>
        <td class="num-cell" style="color:var(--accent-emerald);">${st.arrestRate}%</td>
        <td class="num-cell">${st.riskIndex}점</td>
        <td><span class="badge ${st.riskGrade.badgeClass}">${st.riskGrade.label}</span></td>
      </tr>
    `;
  }).join('');
}

function renderCharts() {
  const dataset = getDataset();
  if (!dataset.length) return;

  const sortedByRate = [...dataset].sort((a, b) => b.ratePer100k - a.ratePer100k).slice(0, 10);
  const maxRate = sortedByRate[0]?.ratePer100k || 1;

  const rateChartContainer = document.getElementById('chart-high-rate');
  if (rateChartContainer) {
    rateChartContainer.innerHTML = sortedByRate.map(st => {
      const widthPct = Math.min(100, Math.max(10, (st.ratePer100k / maxRate) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label" title="${st.stationName}">${st.stationName}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${widthPct}%;"></div>
          </div>
          <div class="bar-value">${st.ratePer100k}</div>
        </div>
      `;
    }).join('');
  }

  const sortedByArrest = [...dataset].sort((a, b) => b.arrestRate - a.arrestRate).slice(0, 10);
  const arrestChartContainer = document.getElementById('chart-high-arrest');
  if (arrestChartContainer) {
    arrestChartContainer.innerHTML = sortedByArrest.map(st => {
      return `
        <div class="bar-row">
          <div class="bar-label" title="${st.stationName}">${st.stationName}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${st.arrestRate}%; background: linear-gradient(90deg, #10b981, #06b6d4);"></div>
          </div>
          <div class="bar-value">${st.arrestRate}%</div>
        </div>
      `;
    }).join('');
  }
}

// 12. 경찰서 상세 모달 팝업
function openModal(stationName) {
  const dataset = getDataset();
  const st = dataset.find(s => s.stationName === stationName);
  if (!st) return;

  const modalTitle = document.getElementById('modal-station-title');
  const modalSub = document.getElementById('modal-station-sub');
  const modalPop = document.getElementById('modal-pop');
  const modalRate = document.getElementById('modal-rate');
  const modalArrest = document.getElementById('modal-arrest');
  const modalGrade = document.getElementById('modal-grade');

  const modalM = document.getElementById('modal-m');
  const modalR = document.getElementById('modal-r');
  const modalS = document.getElementById('modal-s');
  const modalT = document.getElementById('modal-t');
  const modalV = document.getElementById('modal-v');

  if (modalTitle) modalTitle.textContent = `${st.stationName} 상세 분석`;
  if (modalSub) modalSub.textContent = `${st.agencyRegion} 경찰청 관할 구역 치안 범죄 통계`;

  if (modalPop) modalPop.textContent = `${st.population.toLocaleString()} 명`;
  if (modalRate) modalRate.textContent = `${st.ratePer100k} 건/10만명`;
  if (modalArrest) modalArrest.textContent = `${st.arrestRate}% (${st.arrests.toLocaleString()}건 검거 / ${st.occurrences.toLocaleString()}건 발생)`;
  if (modalGrade) modalGrade.innerHTML = `<span class="badge ${st.riskGrade.badgeClass}">${st.riskGrade.label} (위험지수: ${st.riskIndex}점)</span>`;

  if (modalM) modalM.textContent = `${st.breakdown.murder.toLocaleString()} 건`;
  if (modalR) modalR.textContent = `${st.breakdown.robbery.toLocaleString()} 건`;
  if (modalS) modalS.textContent = `${st.breakdown.sexualAssault.toLocaleString()} 건`;
  if (modalT) modalT.textContent = `${st.breakdown.theft.toLocaleString()} 건`;
  if (modalV) modalV.textContent = `${st.breakdown.violence.toLocaleString()} 건`;

  const modal = document.getElementById('detail-modal');
  if (modal) modal.classList.add('active');
}

function closeModal() {
  document.getElementById('detail-modal').classList.remove('active');
}

function closeModalOnOverlay(e) {
  if (e.target.id === 'detail-modal') {
    closeModal();
  }
}

// 13. 클립보드 복사
function copySnippet(elementId) {
  const codeText = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(codeText).then(() => {
    showToast('클립보드에 자바스크립트 코드가 복사되었습니다!');
  });
}

function copyActiveTabSnippet() {
  copySnippet('gallery-code-display');
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function scrollToElement(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}
