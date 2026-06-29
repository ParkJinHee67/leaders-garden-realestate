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
