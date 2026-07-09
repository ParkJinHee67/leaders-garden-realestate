import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PropertyCard from '../components/PropertyCard';
import LocationMap from '../components/LocationMap';
import ErrorBoundary from '../components/ErrorBoundary';
import { NavermapsProvider } from 'react-naver-maps';
import { properties as fallbackProperties } from '../data';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useSiteSettings } from '../context/SiteContext';
import { checkRegistrationExpiry } from '../utils/imageHelper';

export default function Home() {
  const siteSettings = useSiteSettings();
  const [propertiesList, setPropertiesList] = useState([]);
  const [commonCodes, setCommonCodes] = useState([]);
  const [selectedPropertyType, setSelectedPropertyType] = useState(() => sessionStorage.getItem('filter_property_type') || 'ALL');
  const [selectedTransactionType, setSelectedTransactionType] = useState(() => sessionStorage.getItem('filter_transaction_type') || 'ALL');
  const [selectedVerificationType, setSelectedVerificationType] = useState(() => sessionStorage.getItem('filter_verification_type') || 'ALL');
  const [selectedExpiryFilter, setSelectedExpiryFilter] = useState(() => sessionStorage.getItem('filter_expiry') || 'ALL');
  const [searchKeyword, setSearchKeyword] = useState(() => sessionStorage.getItem('filter_keyword') || '');

  // 부동산 뉴스 관련 State
  const [newsList, setNewsList] = useState([]);
  const [selectedNewsTab, setSelectedNewsTab] = useState('ALL');
  const [newsLimit, setNewsLimit] = useState(4);
  const [copiedId, setCopiedId] = useState(null);

  const filteredNews = newsList.filter(news => {
    if (selectedNewsTab === 'ALL') return true;
    const titleAndDesc = ((news.title || '') + ' ' + (news.content || '') + ' ' + (news.description || '')).toLowerCase();
    
    if (selectedNewsTab === 'OKJEONG_YANGJU') {
      return titleAndDesc.includes('옥정') || titleAndDesc.includes('양주') || titleAndDesc.includes('회천');
    }
    if (selectedNewsTab === 'GTX') {
      return titleAndDesc.includes('gtx');
    }
    if (selectedNewsTab === 'HOT_NEWS') {
      return titleAndDesc.includes('분양') || titleAndDesc.includes('공급') || titleAndDesc.includes('핫뉴스') || titleAndDesc.includes('시장') || titleAndDesc.includes('동향') || titleAndDesc.includes('매매') || titleAndDesc.includes('전세') || titleAndDesc.includes('가격');
    }
    if (selectedNewsTab === 'REGULATION') {
      return titleAndDesc.includes('규제') || titleAndDesc.includes('대책') || titleAndDesc.includes('법') || titleAndDesc.includes('세금') || titleAndDesc.includes('금리');
    }
    return true;
  });

  const parseNewsContent = (content) => {
    if (!content) return [];
    const lines = content.split('\n');
    return lines.map(line => {
      const cleanLine = line.replace(/^📌\[\d+\]\s*/, '').trim();
      const match = cleanLine.match(/^\*\*(.*?)\*\*:(.*)$/) || cleanLine.match(/^\*\*(.*?)\*\*(.*)$/);
      if (match) {
        return {
          keyword: match[1].trim(),
          text: match[2].trim().replace(/^:\s*/, '')
        };
      }
      return {
        keyword: '',
        text: cleanLine
      };
    }).filter(item => item.text || item.keyword);
  };

  useEffect(() => {
    sessionStorage.setItem('filter_expiry', selectedExpiryFilter);
  }, [selectedExpiryFilter]);

  useEffect(() => {
    sessionStorage.setItem('filter_property_type', selectedPropertyType);
  }, [selectedPropertyType]);

  useEffect(() => {
    sessionStorage.setItem('filter_transaction_type', selectedTransactionType);
  }, [selectedTransactionType]);

  useEffect(() => {
    sessionStorage.setItem('filter_verification_type', selectedVerificationType);
  }, [selectedVerificationType]);

  useEffect(() => {
    sessionStorage.setItem('filter_keyword', searchKeyword);
  }, [searchKeyword]);

  const filteredProperties = propertiesList.filter(property => {
    // 1. 매물 종류 필터링
    if (selectedPropertyType !== 'ALL' && property.property_type_code !== selectedPropertyType) {
      return false;
    }
    // 2. 거래 방식 필터링
    if (selectedTransactionType !== 'ALL' && property.transaction_type_code !== selectedTransactionType) {
      return false;
    }
    // 3. 검증 방식 필터링
    if (selectedVerificationType !== 'ALL' && property.verification_type !== selectedVerificationType) {
      return false;
    }
    // 3.5. 등록 기간 필터링
    if (selectedExpiryFilter !== 'ALL') {
      const { isExpired, isNearExpiry, daysRemaining } = checkRegistrationExpiry(property.registration_period);
      if (selectedExpiryFilter === 'EXPIRED' && !isExpired) return false;
      if (selectedExpiryFilter === 'NEAR_EXPIRY' && !isNearExpiry) return false;
      if (selectedExpiryFilter === 'NEAR_EXPIRY_5' && !(daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 5)) return false;
      if (selectedExpiryFilter === 'ALERT' && !(isExpired || isNearExpiry)) return false;
    }
    // 4. 검색어 필터링 (제목, 주소, 상세 설명에서 검색)
    if (searchKeyword.trim() !== '') {
      const query = searchKeyword.toLowerCase();
      const titleMatch = property.title?.toLowerCase().includes(query);
      const addressMatch = property.address?.toLowerCase().includes(query);
      const descMatch = property.description?.toLowerCase().includes(query);
      if (!titleMatch && !addressMatch && !descMatch) {
        return false;
      }
    }
    return true;
  });

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        if (!supabase) {
          setPropertiesList(fallbackProperties.filter(p => p.isRecommended));
          return;
        }
        const { data, error } = await supabase.from('properties_v2').select('*, complexes(image_url)').neq('status', '거래완료').order('created_at', { ascending: false });
        if (error) throw error;
        
        const { data: codeData } = await supabase.from('common_codes').select('*');
        setCommonCodes(codeData || []);
        
        if (data && data.length > 0) {
          setPropertiesList(data);
        } else {
          setPropertiesList(fallbackProperties.filter(p => p.isRecommended));
        }
      } catch (error) {
        console.error("매물 불러오기 오류:", error);
        setPropertiesList(fallbackProperties.filter(p => p.isRecommended));
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('ai_news')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setNewsList(data || []);
      } catch (error) {
        console.error("뉴스 불러오기 오류:", error);
      }
    };
    fetchNews();
  }, []);

  // 헤더 링크 클릭 시 필터 초기화 이벤트 리스너
  useEffect(() => {
    const handleReset = () => {
      setSelectedPropertyType('ALL');
      setSelectedTransactionType('ALL');
      setSelectedVerificationType('ALL');
      setSelectedExpiryFilter('ALL');
      setSearchKeyword('');
    };
    
    window.addEventListener('reset-home-filters', handleReset);
    return () => window.removeEventListener('reset-home-filters', handleReset);
  }, []);

  // 타 페이지에서 매물검색 클릭하여 유입 시 스크롤 처리
  useEffect(() => {
    const scrollToSection = sessionStorage.getItem('scroll_to_properties');
    if (scrollToSection === 'true' && propertiesList.length > 0) {
      sessionStorage.removeItem('scroll_to_properties');
      const timer = setTimeout(() => {
        const element = document.getElementById('properties');
        if (element) {
          element.scrollIntoView({ behavior: 'auto' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [propertiesList]);

  // 타 페이지에서 뉴스 브리핑 클릭하여 유입 시 스크롤 처리
  useEffect(() => {
    const scrollToNews = sessionStorage.getItem('scroll_to_news');
    if (scrollToNews === 'true' && newsList.length > 0) {
      sessionStorage.removeItem('scroll_to_news');
      const timer = setTimeout(() => {
        const element = document.getElementById('news');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [newsList]);

  // 스크롤 위치 감지 및 저장
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem('home_scroll_y', window.scrollY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 매물 목록이 로드되면 이전 스크롤 위치 복원
  useEffect(() => {
    if (propertiesList.length > 0) {
      const savedScrollY = sessionStorage.getItem('home_scroll_y');
      if (savedScrollY) {
        const timer = setTimeout(() => {
          window.scrollTo({
            top: parseInt(savedScrollY),
            behavior: 'instant'
          });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [propertiesList]);

  // .env 값을 우선 안전한 기본값으로 사용, DB 값이 있으면 덮어씀
  const envClientId = import.meta.env.VITE_NAVER_MAPS_CLIENT_ID || '';
  const clientId = siteSettings?.naver_map_client_id || envClientId;

  return (
    <NavermapsProvider key={clientId || 'no-key'} ncpKeyId={clientId || envClientId} submodules={['geocoder']}>
      <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-[400px] flex items-center justify-center bg-brand-green">
          {/* 사무실 사진 적용 */}
          <div className="absolute inset-0 bg-black/40 z-10" />
          <img 
            src={siteSettings?.hero_image_url || "/사무실_사진.jpeg"} 
            alt="Office background" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-20 text-center px-4 text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 drop-shadow-lg whitespace-pre-wrap">{(siteSettings?.slogan_main || '고객의 꿈을 찾아드리는\n리더스가든 부동산').replace(/\\n/g, '\n')}</h1>
            <p className="text-lg md:text-xl text-gray-200 drop-shadow-md">{siteSettings?.slogan_sub || '최고의 매물, 정직한 중개로 보답하겠습니다.'}</p>
          </div>
        </section>

        {/* GTX-C Banner */}
        <div className="bg-gradient-to-r from-brand-orange to-orange-500 py-5 px-4 text-white text-center transform transition duration-300 hover:shadow-lg relative overflow-hidden group border-y border-orange-600">
          <Link to="/gtx" className="block absolute inset-0 z-20"></Link>
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition z-10 pointer-events-none"></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <span className="bg-white text-brand-orange px-4 py-1.5 rounded-full font-bold text-sm uppercase tracking-wider shadow-sm animate-bounce">🔥 Hot Issue</span>
            <span className="text-lg md:text-xl font-bold tracking-tight">GTX-C 노선 개통 확정! 강남(삼성)까지 27분? 시간 비교 보기 👉</span>
          </div>
        </div>

        {/* CEO Introduction Section */}
        <section id="about" className="py-20 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="w-full lg:w-[55%] flex flex-col sm:flex-row items-center gap-6">
                {/* QR 코드 카드 */}
                <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center justify-center shrink-0 w-44 hover:scale-105 transition-transform duration-300">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin)}`} 
                    alt="QR Code" 
                    className="w-32 h-32 object-contain"
                  />
                  <span className="text-[11px] font-bold text-gray-500 mt-2 block text-center">휴대폰 카메라로 스캔<br/>홈페이지 바로가기</span>
                </div>
                
                {/* CEO 명함 이미지 */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white transform transition duration-500 hover:scale-105 bg-gray-50 flex-grow">
                  <img 
                    src={siteSettings?.ceo_image_url || "/유현휘소장_사진.png"} 
                    alt="CEO 명함" 
                    className="w-full h-auto object-contain"
                  />
                </div>
              </div>
              <div className="w-full lg:w-[45%] lg:pl-4">
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                  신뢰와 정직으로,<br/>
                  <span className="text-brand-orange">최고의 선택</span>을 돕겠습니다.
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                  옥정신도시 전문 리더스가든 부동산을 찾아주셔서 감사합니다. 
                  저희는 단순한 중개를 넘어, 고객님의 소중한 자산과 미래를 함께 고민하는 든든한 파트너가 되겠습니다.
                </p>
                <div className="flex flex-wrap gap-4 mt-8">
                  <div className="bg-brand-green/10 text-brand-green px-6 py-3 rounded-full font-bold shadow-sm">
                    #책임중개
                  </div>
                  <div className="bg-brand-green/10 text-brand-green px-6 py-3 rounded-full font-bold shadow-sm">
                    #상가전문
                  </div>
                  <div className="bg-brand-green/10 text-brand-green px-6 py-3 rounded-full font-bold shadow-sm">
                    #아파트매매
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 오늘의 부동산 브리핑 Section */}
        <section id="news" className="py-20 bg-gray-50 border-t border-gray-205">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-10">
              <span className="bg-brand-orange/10 text-brand-orange px-4 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider shadow-sm inline-block mb-3">📰 AI Daily Briefing</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4 leading-tight">오늘의 부동산 브리핑</h2>
              <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto">
                GTX-C, 옥정·양주신도시, 청약 일정 및 부동산 규제 등 주요 뉴스를 AI가 매일 오전 8시에 분석하고 요약해 드립니다.
              </p>
            </div>

            {/* 필터 탭 */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {[
                { id: 'ALL', label: '전체' },
                { id: 'GTX', label: '🚀 GTX-C' },
                { id: 'OKJEONG_YANGJU', label: '🏡 옥정·양주' },
                { id: 'HOT_NEWS', label: '📋 핫뉴스·분양' },
                { id: 'REGULATION', label: '⚖️ 규제·대책' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedNewsTab(tab.id);
                    setNewsLimit(4); // 필터 변경 시 페이징 초기화
                  }}
                  className={`px-5 py-2.5 rounded-full font-bold text-xs md:text-sm transition-all duration-300 shadow-sm cursor-pointer ${
                    selectedNewsTab === tab.id
                      ? 'bg-brand-green text-white scale-105'
                      : 'bg-white text-gray-650 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 뉴스 그리드 (데스크톱 4열, 태블릿 2열, 모바일 1열) */}
            {filteredNews.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredNews.slice(0, newsLimit).map(news => {
                  const parsedPoints = parseNewsContent(news.content || news.description);
                  return (
                    <div
                      key={news.id}
                      onClick={() => window.open(news.source_url, '_blank')}
                      className="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-150 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col group h-full relative"
                    >
                      {/* 썸네일 이미지 */}
                      <div className="relative h-44 w-full bg-gray-100 overflow-hidden shrink-0">
                        {news.image_url ? (
                          <img
                            src={news.image_url}
                            alt={news.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          // Fallback elegant real estate SVG
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 text-brand-green">
                            <svg className="w-16 h-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75V3.75A.75.75 0 013 3zm13.5 9h5.25m-5.25 3h5.25M16.5 9h5.25M21 3v18" />
                            </svg>
                          </div>
                        )}
                        <span className="absolute top-3 left-3 bg-brand-orange text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm">
                          부동산 브리핑
                        </span>
                      </div>

                      {/* 카드 바디 */}
                      <div className="p-5 flex flex-col flex-grow">
                        {/* 등록일 및 공유 버튼 */}
                        <div className="flex items-center justify-between text-gray-400 text-[11px] mb-3 font-semibold shrink-0">
                          <span className="flex items-center gap-1">
                            📅 {new Date(news.created_at).toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: false
                            })}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // 카드 클릭 원문 이동 방지
                              navigator.clipboard.writeText(news.source_url);
                              setCopiedId(news.id);
                              setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition cursor-pointer"
                            title="기사 링크 복사"
                          >
                            {copiedId === news.id ? (
                              <span className="text-[10px] text-brand-green font-bold flex items-center gap-0.5">✓ 복사됨</span>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 10.742l4.636-2.318a3 3 0 11.758 1.517l-4.636 2.318a3 3 0 11-.758-1.517z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.258l4.636 2.318a3 3 0 10.758-1.517l-4.636-2.318a3 3 0 10-.758 1.517z" />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* 뉴스 제목 */}
                        <h3 className="font-extrabold text-sm text-gray-900 mb-4 line-clamp-2 group-hover:text-brand-orange transition-colors duration-200">
                          {news.title}
                        </h3>

                        {/* AI 요약 리스트 */}
                        <ul className="space-y-3 text-xs text-gray-600 flex-grow">
                          {parsedPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-relaxed">
                              <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center text-[10px] font-extrabold mt-0.5">
                                {idx + 1}
                              </span>
                              <div>
                                {point.keyword && (
                                  <strong className="text-gray-800 font-extrabold mr-1 bg-brand-green/5 px-1 py-0.5 rounded text-[11px]">
                                    {point.keyword}
                                  </strong>
                                )}
                                <span className="text-gray-650">{point.text}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500 bg-white rounded-3xl border border-gray-200 shadow-sm max-w-xl mx-auto">
                해당 필터 키워드의 최근 뉴스 브리핑이 없습니다.
              </div>
            )}

            {/* 더 보기 버튼 */}
            {filteredNews.length > newsLimit && (
              <div className="text-center mt-12">
                <button
                  onClick={() => setNewsLimit(prev => prev + 4)}
                  className="bg-white border border-gray-300 text-gray-700 hover:text-brand-green hover:border-brand-green px-8 py-3.5 rounded-full font-bold text-xs md:text-sm shadow-sm transition-all duration-300 hover:scale-105 cursor-pointer"
                >
                  브리핑 더 보기 ➔
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Property List Section */}
        <section id="properties" className="py-20 container mx-auto px-4">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">매물 안내</h2>
              <p className="text-gray-500">* 정확한 매물 정보는 전화 또는 방문 상담을 통해 확인하세요.</p>
            </div>
            <Link to="/consult/request" className="hidden md:flex items-center gap-1 font-bold text-brand-green hover:text-green-800 transition">
              전체 매물 문의 &rarr;
            </Link>
          </div>

          {/* 필터 및 검색 영역 */}
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm mb-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex-grow max-w-md relative">
                <input 
                  type="text" 
                  placeholder="단지명, 아파트 이름 또는 지역 검색 (예: 에피트, 푸르지오, 회정동)" 
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none text-sm transition"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              </div>
              <div className="text-right text-gray-500 font-bold text-sm shrink-0">
                조회 결과: <span className="text-brand-orange text-lg font-black">{filteredProperties.length}</span> 건의 매물
              </div>
            </div>

            <div className="space-y-4">
              {/* 매물 종류 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-black text-gray-400 tracking-wider w-16 shrink-0">매물 종류</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: '전체' },
                    { id: 'APT', label: '아파트/분양권' },
                    { id: 'COMMERCIAL', label: '상가/사무실' },
                    { id: 'OFFICETEL', label: '오피스텔' },
                    { id: 'VILLA', label: '빌라/연립/주택' },
                    { id: 'ONE_ROOM', label: '원룸/투룸' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedPropertyType(option.id)}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
                        selectedPropertyType === option.id 
                        ? 'bg-brand-green text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-250'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 거래 방식 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-black text-gray-400 tracking-wider w-16 shrink-0">거래 방식</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: '전체' },
                    { id: 'SALE', label: '매매' },
                    { id: 'JEONSE', label: '전세' },
                    { id: 'MONTHLY', label: '월세' },
                    { id: 'SHORT_TERM', label: '단기임대' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedTransactionType(option.id)}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
                        selectedTransactionType === option.id 
                        ? 'bg-brand-orange text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-250'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검증 방식 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-black text-gray-400 tracking-wider w-16 shrink-0">검증 방식</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: '전체' },
                    { id: '모', label: '모바일 V2' },
                    { id: '현', label: '현장확인' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedVerificationType(option.id)}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
                        selectedVerificationType === option.id 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-250'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 등록 기간 필터 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-xs font-black text-gray-400 tracking-wider w-16 shrink-0">등록 기간</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ALL', label: '전체' },
                    { id: 'EXPIRED', label: '⚠️ 만료됨' },
                    { id: 'NEAR_EXPIRY', label: '⏳ 만료임박 (3일)' },
                    { id: 'NEAR_EXPIRY_5', label: '⏳ 만료예정 (5일)' },
                    { id: 'ALERT', label: '🚨 만료/3일이내' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSelectedExpiryFilter(option.id)}
                      className={`px-4 py-1.5 rounded-full font-bold text-xs transition ${
                        selectedExpiryFilter === option.id 
                        ? 'bg-red-500 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-250'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.length > 0 ? (
              filteredProperties.map(property => (
                <PropertyCard key={property.id} property={property} commonCodes={commonCodes} />
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-2xl border border-gray-100">
                선택하신 조건에 해당하는 매물이 없습니다.
              </div>
            )}
          </div>
        </section>

        {/* Location Section */}
        <section id="location" className="py-20 bg-gray-50 border-t border-gray-200">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">오시는 길</h2>
              <p className="text-gray-500">{(siteSettings?.name || '리더스가든 부동산')}으로 찾아오시는 길을 안내해 드립니다.</p>
            </div>
            <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100">
              <ErrorBoundary>
                {clientId ? (
                  <LocationMap />
                ) : (
                  <div className="flex items-center justify-center h-[400px] bg-gray-100 rounded-2xl">
                    <div className="text-center text-gray-400">
                      <div className="w-10 h-10 border-4 border-brand-green border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm">지도를 불러오는 중...</p>
                    </div>
                  </div>
                )}
              </ErrorBoundary>
              <div className="mt-6 p-4 bg-brand-green/5 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 mb-1">{siteSettings?.name || '리더스가든 부동산'}</h3>
                  <p className="text-gray-600">{siteSettings?.address || '경기도 양주시 회천로 234 (e편한세상 옥정 리더스가든)'}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`tel:${siteSettings?.phone || '010-4630-0363'}`} className="bg-brand-orange text-white px-6 py-2 rounded-full font-bold shadow-md hover:bg-orange-700 transition">
                    전화 연결
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
    </NavermapsProvider>
  );
}
