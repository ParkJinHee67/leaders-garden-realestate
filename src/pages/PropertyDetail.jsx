import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Bed, Bath, Maximize, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { properties as fallbackProperties } from '../data';
import { supabase } from '../supabaseClient';
import { useSiteSettings } from '../context/SiteContext';
import { getPropertyImage, formatAddressWithoutHo, cleanTextWithoutHo } from '../utils/imageHelper';

export default function PropertyDetail() {
  const { id } = useParams();
  const siteSettings = useSiteSettings();
  const [property, setProperty] = useState(null);
  const [commonCodes, setCommonCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        if (!supabase) {
          setProperty(fallbackProperties.find(p => p.id === parseInt(id)));
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.from('properties_v2').select('*, complexes(image_url)').eq('id', id).single();
        const { data: codeData } = await supabase.from('common_codes').select('*');
        setCommonCodes(codeData || []);

        if (error) {
          setProperty(fallbackProperties.find(p => p.id === parseInt(id)));
        } else {
          setProperty(data);
        }
      } catch (error) {
        console.error(error);
        setProperty(fallbackProperties.find(p => p.id === parseInt(id)));
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  if (loading) return <div className="p-20 text-center">매물 정보를 불러오는 중입니다...</div>;
  if (!property) return <div className="p-20 text-center">매물을 찾을 수 없습니다.</div>;
  if (property.status === '거래완료') return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-grow flex items-center justify-center p-8">
        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200 text-center max-w-md w-full shadow-lg">
          <div className="text-brand-orange text-5xl mb-4">🏠</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">거래 완료 매물</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            아쉽게도 해당 매물은 거래가 이미 완료(종료)되었습니다. 다른 매물을 확인해 보세요.
          </p>
          <Link to="/" className="inline-block bg-brand-green text-white font-bold px-6 py-2.5 rounded-xl hover:bg-green-800 transition">
            메인 화면으로 가기
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );

  // 전체 이미지 배열 (대표 이미지 + 추가 이미지)
  const allImages = [
    ...(property ? [getPropertyImage(property)] : []),
    ...(property.extra_images || [])
  ].filter(Boolean);

  const prevSlide = () => setCurrentSlide(i => (i - 1 + allImages.length) % allImages.length);
  const nextSlide = () => setCurrentSlide(i => (i + 1) % allImages.length);
  const openLightbox = (idx) => { setLightboxIndex(idx); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);
  const prevLight = () => setLightboxIndex(i => (i - 1 + allImages.length) % allImages.length);
  const nextLight = () => setLightboxIndex(i => (i + 1) % allImages.length);

  const propertyTypeName = commonCodes.find(c => c.code_value === property.property_type_code)?.code_name || property.property_type_code || property.type;
  const transactionTypeName = commonCodes.find(c => c.code_value === property.transaction_type_code)?.code_name || property.transaction_type_code || '';
  const phone = siteSettings?.phone || '010-4630-0363';

  let formattedPrice = property.price || '';
  if (property.price_main) {
    formattedPrice = `${transactionTypeName} ${property.price_main.toLocaleString()}만`;
    if (property.price_monthly > 0) {
      formattedPrice = `${transactionTypeName} ${property.price_main.toLocaleString()}만 / 월 ${property.price_monthly.toLocaleString()}만`;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-orange mb-6 transition">
          <ArrowLeft size={20} />
          <span>목록으로 돌아가기</span>
        </Link>
        
        <div className="max-w-4xl mx-auto">

          {/* ===== 이미지 슬라이드 갤러리 ===== */}
          <div className="rounded-3xl overflow-hidden mb-6 shadow-lg bg-black relative">
            {/* 메인 슬라이드 이미지 */}
            <div className="relative aspect-video cursor-pointer" onClick={() => openLightbox(currentSlide)}>
              <img
                src={allImages[currentSlide] || '/placeholder.jpg'}
                alt={`${property.title} - ${currentSlide + 1}`}
                className="w-full h-full object-cover"
              />
              {/* 이미지 번호 */}
              {allImages.length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-full">
                  {currentSlide + 1} / {allImages.length}
                </div>
              )}
              {/* 확대 힌트 */}
              <div className="absolute top-4 right-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
                🔍 클릭하면 크게 보기
              </div>
            </div>

            {/* 이전/다음 화살표 */}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center transition z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white w-10 h-10 rounded-full flex items-center justify-center transition z-10"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>

          {/* 썸네일 목록 */}
          {allImages.length > 1 && (
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`flex-shrink-0 w-20 h-16 rounded-xl overflow-hidden border-2 transition ${
                    currentSlide === idx ? 'border-brand-orange scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`썸네일 ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-grow">
              <div className="flex gap-2 mb-4">
                <span className="bg-brand-green text-white px-3 py-1 rounded-full text-sm font-bold">{propertyTypeName}</span>
                {property.isRecommended && <span className="bg-brand-orange text-white px-3 py-1 rounded-full text-sm font-bold">추천</span>}
                {property.isUrgent && <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">급매</span>}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 animate-fade-in">
                {property.verification_type && (
                  <span className={`inline-flex items-center justify-center text-sm font-black w-7 h-7 rounded-lg mr-2 align-middle ${
                    property.verification_type === '집' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                    property.verification_type === '현' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    property.verification_type === '서' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                    property.verification_type === '전' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                    property.verification_type === '모' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                    'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {property.verification_type}
                  </span>
                )}
                <span className="align-middle">{cleanTextWithoutHo(property.title, property.verification_type)}</span>
              </h1>
              <p className="text-3xl font-black text-brand-orange mb-6">{formattedPrice}</p>
              
              <div className="flex items-center gap-2 text-gray-600 text-lg mb-8 bg-gray-50 p-4 rounded-xl">
                <MapPin className="text-brand-green" />
                <span>{formatAddressWithoutHo(property.address, property.verification_type)}</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">매물 상세 설명</h3>
              <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                {property.description}
                <br/><br/>
                본 매물은 리더스가든 부동산에서 직접 확인한 매물입니다.
                더 자세한 사항은 전화 문의 주시면 친절하게 상담해 드리겠습니다.
              </p>
            </div>
            
            <div className="w-full md:w-80 flex-shrink-0 space-y-6">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <h3 className="font-bold text-lg mb-4 text-gray-900">매물 스펙</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><Maximize size={18}/>면적</span>
                    <span className="font-bold">{property.size}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><Bed size={18}/>방</span>
                    <span className="font-bold">{property.rooms}개</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2"><Bath size={18}/>욕실</span>
                    <span className="font-bold">{property.baths}개</span>
                  </div>
                  {property.registration_period && (
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-4">
                      <span className="text-gray-500 flex items-center gap-2">📅 등록기간</span>
                      <span className="font-bold font-mono text-xs text-gray-700">{property.registration_period}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-brand-orange p-6 rounded-2xl text-white text-center shadow-md">
                <h3 className="font-bold text-lg mb-2">담당자 연락처</h3>
                <p className="text-3xl font-black mb-4">{phone}</p>
                <a href={`tel:${phone}`} className="block w-full bg-white text-brand-orange font-bold py-3 rounded-xl hover:bg-orange-50 transition">
                  전화 걸기
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* ===== 라이트박스 (전체화면 확대 보기) ===== */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button onClick={closeLightbox} className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/40 w-10 h-10 rounded-full flex items-center justify-center z-10">
            <X size={24} />
          </button>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full">
            {lightboxIndex + 1} / {allImages.length}
          </div>

          <img
            src={allImages[lightboxIndex]}
            alt={`확대 ${lightboxIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />

          {allImages.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevLight(); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-12 h-12 rounded-full flex items-center justify-center transition"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextLight(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white w-12 h-12 rounded-full flex items-center justify-center transition"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          {/* 라이트박스 썸네일 */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] pb-1">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                className={`flex-shrink-0 w-14 h-11 rounded-lg overflow-hidden border-2 transition ${
                  lightboxIndex === idx ? 'border-brand-orange scale-110' : 'border-white/30 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
