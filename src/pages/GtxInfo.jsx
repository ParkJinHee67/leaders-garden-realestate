import { motion, animate } from 'framer-motion';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';
import { ArrowLeft, Train, Map, Clock, TrendingUp, Building } from 'lucide-react';
import { properties as fallbackProperties } from '../data';
import PropertyCard from '../components/PropertyCard';
import { supabase } from '../supabaseClient';

function AnimatedNumber({ from, to, duration = 2, delay = 0 }) {
  const [value, setValue] = useState(from);
  
  useEffect(() => {
    const controls = animate(from, to, {
      duration: duration,
      delay: delay,
      ease: "easeOut",
      onUpdate: (latest) => setValue(Math.round(latest))
    });
    
    return () => {
      if (controls && controls.stop) {
        controls.stop();
      }
    };
  }, [from, to, duration, delay]);

  return <span>{value}</span>;
}

export default function GtxInfo() {
  const [station] = useState('덕정');
  const [recommendedProperties, setRecommendedProperties] = useState([]);
  const [commonCodes, setCommonCodes] = useState([]);

  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        if (!supabase) {
          setRecommendedProperties(fallbackProperties.filter(p => p.isRecommended).slice(0, 3));
          return;
        }
        
        const { data: codeData } = await supabase.from('common_codes').select('*');
        setCommonCodes(codeData || []);

        const { data, error } = await supabase
          .from('properties_v2')
          .select('*, complexes(image_url)')
          .eq('isRecommended', true)
          .neq('status', '거래완료')
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (error) throw error;
        
        if (data && data.length > 0) {
          setRecommendedProperties(data);
        } else {
          setRecommendedProperties(fallbackProperties.filter(p => p.isRecommended).slice(0, 3));
        }
      } catch (err) {
        console.error("추천 매물 불러오기 오류:", err);
        setRecommendedProperties(fallbackProperties.filter(p => p.isRecommended).slice(0, 3));
      }
    };
    fetchRecommended();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center text-brand-orange font-bold hover:underline">
            <ArrowLeft size={20} className="mr-2" /> 메인으로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header Area */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white text-center relative overflow-hidden">
            <motion.div 
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: '100%', opacity: 0.1 }}
              transition={{ duration: 3, ease: "linear", repeat: Infinity }}
              className="absolute inset-y-0 left-0 flex items-center justify-center pointer-events-none"
            >
              <Train size={300} />
            </motion.div>
            
            <div className="relative z-10">
              <div className="inline-block px-4 py-1 bg-brand-orange text-white rounded-full font-bold text-sm mb-4 shadow-lg">
                수도권 광역급행철도
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">GTX-C 노선 개통 프리미엄</h1>
              <p className="text-xl text-gray-300">옥정/덕정 신도시에서 강남까지, 압도적인 시간 단축!</p>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-8 md:p-12">
            <div className="flex flex-col items-center mb-16">
              <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 text-xl md:text-2xl font-bold text-gray-800">
                <div className="bg-gray-100 px-6 py-3 rounded-2xl border-2 border-gray-200">
                  {station}역
                </div>
                <div className="text-gray-400">➡️</div>
                <div className="bg-brand-orange/10 text-brand-orange px-6 py-3 rounded-2xl border-2 border-brand-orange/20 shadow-sm">
                  삼성역 (강남)
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-gray-500 mb-2 font-medium text-lg">예상 소요 시간</p>
                <div className="text-7xl md:text-8xl font-extrabold text-brand-orange flex items-baseline justify-center">
                  <AnimatedNumber from={82} to={27} duration={2} delay={0.5} />
                  <span className="text-3xl md:text-4xl text-gray-600 ml-2">분</span>
                </div>
              </div>
            </div>

            {/* Bar Chart Area */}
            <div className="space-y-8 max-w-2xl mx-auto">
              {/* Line 1 */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-gray-600 flex items-center gap-2">
                    <Train size={18} /> 기존 지하철 1호선
                  </span>
                  <span className="font-bold text-gray-600 text-xl">82분</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-10 overflow-hidden relative shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="bg-gray-400 h-full rounded-full"
                  />
                </div>
              </div>

              {/* GTX-C */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-bold text-brand-orange flex items-center gap-2 text-lg">
                    <Train size={22} /> GTX-C 노선
                  </span>
                  <span className="font-bold text-brand-orange text-2xl">27분</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-10 overflow-hidden relative shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: "33%" }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 1 }}
                    className="bg-brand-orange h-full rounded-full flex items-center justify-end px-4 relative overflow-hidden"
                  >
                    <motion.div
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-white/30 skew-x-12 w-20"
                    />
                    <span className="text-white text-sm font-bold shadow-sm whitespace-nowrap z-10">55분 단축!</span>
                  </motion.div>
                </div>
              </div>
            </div>
            
            {/* Investment Points */}
            <div className="mt-20 grid md:grid-cols-3 gap-8">
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center hover:shadow-md transition">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">워라밸의 완성</h3>
                <p className="text-gray-600">출퇴근 왕복 2시간 단축으로<br/>가족과 함께하는 저녁이 있는 삶</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center hover:shadow-md transition">
                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">높은 미래 가치</h3>
                <p className="text-gray-600">개통 후 확실한 프리미엄<br/>안전한 자산 가치 상승 기대</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 text-center hover:shadow-md transition">
                <div className="w-14 h-14 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">최상의 인프라</h3>
                <p className="text-gray-600">역세권 중심의 상권 활성화 및<br/>완성된 신도시 생활 인프라</p>
              </div>
            </div>

            {/* Recommended Properties */}
            <div className="mt-20">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Map className="text-brand-orange" size={28} /> 수혜 단지 추천 매물
                  </h2>
                  <p className="text-gray-500">GTX-C 노선 개통 시 가장 큰 혜택을 누릴 역세권 매물입니다.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendedProperties.map(property => (
                  <PropertyCard key={property.id} property={property} commonCodes={commonCodes} />
                ))}
              </div>
            </div>
            
            <div className="mt-20 text-center bg-gradient-to-br from-brand-green/10 to-brand-green/5 p-8 rounded-3xl border border-brand-green/20">
              <h3 className="text-2xl font-bold text-brand-green mb-4">
                강남 출퇴근 30분 시대 개막! 
              </h3>
              <p className="text-gray-700 leading-relaxed text-lg">
                출퇴근으로 버려지는 하루 2시간을 가족과 나를 위해 쓰세요.<br/>
                덕정역 도보권 / 옥정신도시 최중심 매물, <b>리더스가든 부동산</b>이 찾아드립니다.
              </p>
              <Link to="/consult/request" className="inline-block mt-8 bg-brand-green text-white font-bold px-10 py-4 rounded-full shadow-lg hover:bg-green-800 transition transform hover:-translate-y-1 text-lg">
                매물 상담 문의하기
              </Link>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
