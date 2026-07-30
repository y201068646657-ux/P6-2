/**
 * ============================================================================
 * 경찰청 공공데이터 - 전국 경찰서별 강력범죄 발생률 계산 및 조회 유틸리티 모듈
 * Police Station Violent Crime Statistics & Rate Utility Module
 * ============================================================================
 */

class PoliceCrimeUtils {
  /**
   * 1. 인구 10만 명당 강력범죄 발생률 산출
   * @param {number} totalCrimes - 강력범죄 발생 총 건수
   * @param {number} population - 관할 구역 인구수
   * @param {number} decimals - 소수점 자릿수 (기본값: 2)
   * @returns {number} 인구 10만 명당 발생률 (건/10만명)
   */
  static calculateCrimeRate100k(totalCrimes, population, decimals = 2) {
    if (!population || population <= 0) return 0;
    const rate = (totalCrimes / population) * 100000;
    return Number(rate.toFixed(decimals));
  }

  /**
   * 2. 강력범죄 검거율 산출 (%)
   * @param {number} totalCrimes - 강력범죄 발생 총 건수
   * @param {number} totalArrests - 강력범죄 검거 총 건수
   * @param {number} decimals - 소수점 자릿수 (기본값: 1)
   * @returns {number} 검거율 (%)
   */
  static calculateArrestRate(totalCrimes, totalArrests, decimals = 1) {
    if (!totalCrimes || totalCrimes <= 0) return 0;
    const rate = (totalArrests / totalCrimes) * 100;
    return Number(rate.toFixed(decimals));
  }

  /**
   * 3. 강력범죄 가중 위험도 지수 산출 (0 ~ 100점 스케일)
   * 5대 강력범죄 중 심각도별 가중치 산출:
   *  - 살인 (Murder): 50
   *  - 강도 (Robbery): 30
   *  - 강간·강제추행 (Sexual Assault): 20
   *  - 절도 (Theft): 5
   *  - 폭력 (Violence): 10
   * @param {Object} breakdown - 범죄 유형별 발생 건수 객체 { murder, robbery, sexualAssault, theft, violence }
   * @param {number} population - 관할 구역 인구수
   * @returns {number} 가중 위험도 지수 (0 ~ 100)
   */
  static calculateRiskIndex(breakdown = {}, population = 100000) {
    if (!population || population <= 0) return 0;

    const weights = {
      murder: 50,
      robbery: 30,
      sexualAssault: 20,
      theft: 5,
      violence: 10
    };

    const weightedSum =
      (breakdown.murder || 0) * weights.murder +
      (breakdown.robbery || 0) * weights.robbery +
      (breakdown.sexualAssault || 0) * weights.sexualAssault +
      (breakdown.theft || 0) * weights.theft +
      (breakdown.violence || 0) * weights.violence;

    // 인구 10만 명 기준으로 정규화 후 로그 스케일링으로 0~100 환산
    const weightedRatePer100k = (weightedSum / population) * 100000;
    
    // 위험도 지수 캡핑 (최대 100)
    const riskIndex = Math.min(100, Math.round(weightedRatePer100k / 80));
    return Math.max(0, riskIndex);
  }

  /**
   * 4. 위험도 지수 및 발생률 기반 안전/위험 등급 반환
   * @param {number} riskIndex - 위험도 지수 (0~100)
   * @returns {Object} { grade: number, label: string, color: string, badgeClass: string }
   */
  static getRiskGrade(riskIndex) {
    if (riskIndex <= 20) {
      return { grade: 1, label: '매우 안전', color: '#10b981', badgeClass: 'badge-safe' };
    } else if (riskIndex <= 40) {
      return { grade: 2, label: '안전', color: '#06b6d4', badgeClass: 'badge-low' };
    } else if (riskIndex <= 60) {
      return { grade: 3, label: '보통', color: '#f59e0b', badgeClass: 'badge-moderate' };
    } else if (riskIndex <= 80) {
      return { grade: 4, label: '주의', color: '#f97316', badgeClass: 'badge-warning' };
    } else {
      return { grade: 5, label: '고위험', color: '#ef4444', badgeClass: 'badge-danger' };
    }
  }

  /**
   * 5. 공공데이터포털(data.go.kr) 경찰청 API 비동기 조회 함수
   * @param {Object} options - API 요청 옵션
   * @param {string} options.serviceKey - 공공데이터포털 인코딩된 서비스키
   * @param {number} [options.pageNo=1] - 페이지 번호
   * @param {number} [options.numOfRows=50] - 한 페이지 결과 수
   * @param {string} [options.stationName=''] - 검색할 경찰서 이름 (옵션)
   * @returns {Promise<Array>} 경찰서별 강력범죄 데이터 배열
   */
  static async fetchPoliceCrimeApi(options = {}) {
    const {
      serviceKey,
      pageNo = 1,
      numOfRows = 50,
      stationName = ''
    } = options;

    if (!serviceKey) {
      throw new Error('공공데이터포털 serviceKey가 필요합니다.');
    }

    // 경찰청_전국 경찰서별 범죄 발생 검거 현황 API 표준 주소 예시
    const baseUrl = 'https://apis.data.go.kr/1320000/PoliceStationCrimeStatsService/getCrimeStats';
    
    let url = `${baseUrl}?serviceKey=${encodeURIComponent(serviceKey)}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;
    if (stationName) {
      url += `&sttnNm=${encodeURIComponent(stationName)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API 호출 실패 (HTTP 상태코드: ${response.status})`);
      }
      
      const json = await response.json();
      
      // 공공데이터 JSON 응답 구조 파싱
      const items = json?.response?.body?.items?.item || json?.items || [];
      
      // 가공된 정규화 데이터 생성
      return items.map(item => {
        const occurrences = Number(item.occrCnt || item.totOccr || 0);
        const arrests = Number(item.arrstCnt || item.totArrst || 0);
        const population = Number(item.popltn || item.poptnCnt || 100000);
        const breakdown = {
          murder: Number(item.murderOccr || 0),
          robbery: Number(item.robberyOccr || 0),
          sexualAssault: Number(item.sexCrimeOccr || 0),
          theft: Number(item.theftOccr || 0),
          violence: Number(item.violenceOccr || 0)
        };

        const ratePer100k = PoliceCrimeUtils.calculateCrimeRate100k(occurrences, population);
        const arrestRate = PoliceCrimeUtils.calculateArrestRate(occurrences, arrests);
        const riskIndex = PoliceCrimeUtils.calculateRiskIndex(breakdown, population);
        const riskGrade = PoliceCrimeUtils.getRiskGrade(riskIndex);

        return {
          stationName: item.sttnNm || item.policeStation || '경찰서',
          agencyRegion: item.sidoNm || item.region || '기타',
          population,
          occurrences,
          arrests,
          breakdown,
          ratePer100k,
          arrestRate,
          riskIndex,
          riskGrade
        };
      });
    } catch (error) {
      console.error('PoliceCrimeUtils.fetchPoliceCrimeApi Error:', error);
      throw error;
    }
  }

  /**
   * 6. 경찰서 데이터 필터링 및 정렬 함수
   * @param {Array} stationList - 경찰서 데이터 리스트
   * @param {Object} filterOptions - 검색 및 필터 옵션
   * @param {string} [filterOptions.region='전체'] - 시/도 경찰청 필터
   * @param {string} [filterOptions.searchKeyword=''] - 경찰서명 검색어
   * @param {string} [filterOptions.sortBy='rateDesc'] - 정렬 기준 ('rateDesc', 'rateAsc', 'occurDesc', 'arrestDesc', 'riskDesc')
   * @returns {Array} 필터링 및 정렬된 경찰서 배열
   */
  static filterAndSortStations(stationList = [], filterOptions = {}) {
    const {
      region = '전체',
      searchKeyword = '',
      sortBy = 'rateDesc'
    } = filterOptions;

    let filtered = stationList.filter(st => {
      // 지역 필터
      if (region !== '전체' && st.agencyRegion !== region) {
        return false;
      }
      // 검색어 필터 (경찰서 이름 or 지역명)
      if (searchKeyword.trim() !== '') {
        const kw = searchKeyword.trim().toLowerCase();
        const matchName = st.stationName.toLowerCase().includes(kw);
        const matchRegion = st.agencyRegion.toLowerCase().includes(kw);
        if (!matchName && !matchRegion) return false;
      }
      return true;
    });

    // 정렬 규칙
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rateDesc':
          return b.ratePer100k - a.ratePer100k;
        case 'rateAsc':
          return a.ratePer100k - b.ratePer100k;
        case 'occurDesc':
          return b.occurrences - a.occurrences;
        case 'arrestDesc':
          return b.arrestRate - a.arrestRate;
        case 'riskDesc':
          return b.riskIndex - a.riskIndex;
        case 'nameAsc':
          return a.stationName.localeCompare(b.stationName, 'ko');
        default:
          return b.ratePer100k - a.ratePer100k;
      }
    });

    return filtered;
  }

  /**
   * 7. 전체 데이터 통계 요약 정보 계산
   * @param {Array} stationList - 전체 경찰서 데이터 리스트
   * @returns {Object} 통계 요약 (전국 평균 발생률, 평균 검거율, 총 발생건수, 총 관할인구 등)
   */
  static getCrimeSummary(stationList = []) {
    if (!stationList.length) {
      return {
        totalStations: 0,
        totalPopulation: 0,
        totalOccurrences: 0,
        totalArrests: 0,
        avgRatePer100k: 0,
        avgArrestRate: 0,
        highestStation: null,
        lowestStation: null
      };
    }

    let totalPopulation = 0;
    let totalOccurrences = 0;
    let totalArrests = 0;

    stationList.forEach(st => {
      totalPopulation += st.population;
      totalOccurrences += st.occurrences;
      totalArrests += st.arrests;
    });

    const sortedByRate = [...stationList].sort((a, b) => b.ratePer100k - a.ratePer100k);
    const avgRatePer100k = PoliceCrimeUtils.calculateCrimeRate100k(totalOccurrences, totalPopulation);
    const avgArrestRate = PoliceCrimeUtils.calculateArrestRate(totalOccurrences, totalArrests);

    return {
      totalStations: stationList.length,
      totalPopulation,
      totalOccurrences,
      totalArrests,
      avgRatePer100k,
      avgArrestRate,
      highestStation: sortedByRate[0] || null,
      lowestStation: sortedByRate[sortedByRate.length - 1] || null
    };
  }
}

// Global Export or Module Export compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PoliceCrimeUtils;
}
