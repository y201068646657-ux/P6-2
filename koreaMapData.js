/**
 * 대한민국 17개 시/도 행정구역 SVG 지형 패스 및 5단계 상대적 범죄율/발생량 집계 모듈
 */

const KOREA_REGION_MAP_DATA = {
  // 1. 도/특별자치도 (바탕 지형)
  '경기': {
    id: 'KR-41',
    name: '경기도',
    shortName: '경기',
    svgPath: 'M140,50 L270,40 L285,100 L260,175 L180,180 L135,130 Z',
    labelPos: { x: 220, y: 75 }
  },
  '강원': {
    id: 'KR-42',
    name: '강원특별자치도',
    shortName: '강원',
    svgPath: 'M270,40 L420,30 L450,140 L310,160 L285,100 Z',
    labelPos: { x: 360, y: 90 }
  },
  '충북': {
    id: 'KR-43',
    name: '충청북도',
    shortName: '충북',
    svgPath: 'M260,175 L330,155 L360,240 L300,265 L250,220 Z',
    labelPos: { x: 310, y: 200 }
  },
  '충남': {
    id: 'KR-44',
    name: '충청남도',
    shortName: '충남',
    svgPath: 'M130,175 L250,175 L250,265 L150,265 L120,210 Z',
    labelPos: { x: 180, y: 220 }
  },
  '경북': {
    id: 'KR-47',
    name: '경상북도',
    shortName: '경북',
    svgPath: 'M330,155 L460,140 L470,285 L380,305 L340,240 Z',
    labelPos: { x: 410, y: 205 }
  },
  '전북': {
    id: 'KR-45',
    name: '전북특별자치도',
    shortName: '전북',
    svgPath: 'M150,265 L280,260 L290,335 L170,340 L140,290 Z',
    labelPos: { x: 220, y: 300 }
  },
  '전남': {
    id: 'KR-46',
    name: '전라남도',
    shortName: '전남',
    svgPath: 'M140,340 L280,335 L260,440 L120,430 L110,380 Z',
    labelPos: { x: 190, y: 395 }
  },
  '경남': {
    id: 'KR-48',
    name: '경상남도',
    shortName: '경남',
    svgPath: 'M290,320 L390,305 L410,390 L300,400 L260,350 Z',
    labelPos: { x: 335, y: 360 }
  },
  '제주': {
    id: 'KR-49',
    name: '제주특별자치도',
    shortName: '제주',
    svgPath: 'M170,475 L260,470 L250,515 L160,520 Z',
    labelPos: { x: 210, y: 495 }
  },

  // 2. 광역시/특별시/특별자치시 (상단 레이어 - 클릭 용이)
  '서울': {
    id: 'KR-11',
    name: '서울특별시',
    shortName: '서울',
    svgPath: 'M185,100 L215,95 L225,120 L200,130 L180,115 Z',
    labelPos: { x: 201, y: 112 }
  },
  '인천': {
    id: 'KR-28',
    name: '인천광역시',
    shortName: '인천',
    svgPath: 'M120,95 L160,95 L160,125 L120,125 Z',
    labelPos: { x: 140, y: 110 }
  },
  '세종': {
    id: 'KR-50',
    name: '세종특별자치시',
    shortName: '세종',
    svgPath: 'M215,195 L245,195 L245,220 L215,220 Z',
    labelPos: { x: 230, y: 207 }
  },
  '대전': {
    id: 'KR-30',
    name: '대전광역시',
    shortName: '대전',
    svgPath: 'M215,225 L248,225 L248,252 L215,252 Z',
    labelPos: { x: 231, y: 238 }
  },
  '광주': {
    id: 'KR-29',
    name: '광주광역시',
    shortName: '광주',
    svgPath: 'M175,350 L215,350 L215,378 L175,378 Z',
    labelPos: { x: 195, y: 364 }
  },
  '대구': {
    id: 'KR-27',
    name: '대구광역시',
    shortName: '대구',
    svgPath: 'M355,250 L395,250 L395,282 L355,282 Z',
    labelPos: { x: 375, y: 266 }
  },
  '울산': {
    id: 'KR-31',
    name: '울산광역시',
    shortName: '울산',
    svgPath: 'M415,300 L455,300 L455,332 L415,332 Z',
    labelPos: { x: 435, y: 316 }
  },
  '부산': {
    id: 'KR-26',
    name: '부산광역시',
    shortName: '부산',
    svgPath: 'M385,345 L435,340 L425,382 L375,380 Z',
    labelPos: { x: 405, y: 362 }
  }
};

const REGION_RENDER_ORDER = [
  '경기', '강원', '충북', '충남', '경북', '전북', '전남', '경남', '제주',
  '서울', '인천', '세종', '대전', '광주', '대구', '울산', '부산'
];

let mapMetricMode = 'rate'; // 'rate' (10만명당 발생률) or 'volume' (총 발생건수)

function setMapMetricMode(mode) {
  mapMetricMode = mode;
}

// 17개 시/도별 통계 집계 및 선택한 지표(발생률 vs 총 발생량) 기준 5단계 등급 부여
function getAggregatedRegionStats(metricMode = mapMetricMode) {
  const regionStats = {};

  Object.keys(KOREA_REGION_MAP_DATA).forEach(reg => {
    regionStats[reg] = {
      ...KOREA_REGION_MAP_DATA[reg],
      totalPopulation: 0,
      totalOccurrences: 0,
      totalArrests: 0,
      breakdown: { murder: 0, robbery: 0, sexualAssault: 0, theft: 0, violence: 0 },
      stations: []
    };
  });

  if (typeof PROCESSED_POLICE_DATASET !== 'undefined') {
    PROCESSED_POLICE_DATASET.forEach(st => {
      const reg = st.agencyRegion;
      if (regionStats[reg]) {
        regionStats[reg].totalPopulation += st.population;
        regionStats[reg].totalOccurrences += st.occurrences;
        regionStats[reg].totalArrests += st.arrests;

        regionStats[reg].breakdown.murder += st.breakdown.murder;
        regionStats[reg].breakdown.robbery += st.breakdown.robbery;
        regionStats[reg].breakdown.sexualAssault += st.breakdown.sexualAssault;
        regionStats[reg].breakdown.theft += st.breakdown.theft;
        regionStats[reg].breakdown.violence += st.breakdown.violence;

        regionStats[reg].stations.push(st);
      }
    });
  }

  const regionList = Object.keys(regionStats).map(reg => {
    const data = regionStats[reg];
    const ratePer100k = PoliceCrimeUtils.calculateCrimeRate100k(data.totalOccurrences, data.totalPopulation);
    const arrestRate = PoliceCrimeUtils.calculateArrestRate(data.totalOccurrences, data.totalArrests);
    data.ratePer100k = ratePer100k;
    data.arrestRate = arrestRate;
    data.stations.sort((a, b) => b.ratePer100k - a.ratePer100k);
    return data;
  });

  // 정렬 지표 선택 (metricMode가 'volume'이면 총 발생건수 기준, 'rate'이면 10만명당 발생률 기준)
  const sorted = [...regionList].sort((a, b) => {
    if (metricMode === 'volume') {
      return a.totalOccurrences - b.totalOccurrences;
    } else {
      return a.ratePer100k - b.ratePer100k;
    }
  });

  const totalCount = sorted.length;

  sorted.forEach((item, index) => {
    const rankPct = index / totalCount; // 0 ~ 1.0

    let riskGrade = {};
    if (rankPct < 0.2) {
      riskGrade = { grade: 1, label: '1등급 (최우수 안전)', color: '#10b981', badgeClass: 'badge-safe' };
    } else if (rankPct < 0.4) {
      riskGrade = { grade: 2, label: '2등급 (안전)', color: '#06b6d4', badgeClass: 'badge-low' };
    } else if (rankPct < 0.6) {
      riskGrade = { grade: 3, label: '3등급 (보통)', color: '#8b5cf6', badgeClass: 'badge-violet' };
    } else if (rankPct < 0.8) {
      riskGrade = { grade: 4, label: '4등급 (주의)', color: '#f59e0b', badgeClass: 'badge-warning' };
    } else {
      riskGrade = { grade: 5, label: '5등급 (고위험)', color: '#ef4444', badgeClass: 'badge-danger' };
    }

    item.riskGrade = riskGrade;
    item.relativeRank = index + 1;
  });

  return regionStats;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KOREA_REGION_MAP_DATA, REGION_RENDER_ORDER, getAggregatedRegionStats, setMapMetricMode };
}
