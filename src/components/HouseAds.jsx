import { ExternalLink } from 'lucide-react';

const HOUSE_ADS = [
  {
    id: 'stellarsaju',
    category: 'AI 사주·운세',
    title: '스텔라사주 - AI 사주풀이',
    description: '오늘의 운세, 띠별 운세, 무료 사주, 타로를 무료로 먼저 보고, 중요한 순간에는 상황별 리포트로 더 깊게 확인해 보세요.',
    buttonText: '무료 운세 보러가기',
    link: 'https://www.stellarsaju.com/?utm_source=readersgarden&utm_medium=house_ad&utm_campaign=briefing',
    disclaimer: null,
  },
  {
    id: 'timebox',
    category: '생산성·플래너',
    title: 'TimeBox Planner - 5분 타임박싱 플래너',
    description: '오늘 가장 중요한 3가지(Top 3), 머릿속 생각 비우기(Brain Dump), 타임라인 계획, 구글 캘린더 연동. 핵심 기능은 무료입니다.',
    buttonText: '플래너 써보기',
    link: 'https://mytimebox.site/?utm_source=readersgarden&utm_medium=house_ad&utm_campaign=briefing',
    disclaimer: null,
  },
  {
    id: 'autotrader',
    category: '토스증권 OpenAPI',
    title: '토스증권 AutoTrader Pro',
    description: '토스증권 OpenAPI 기반 자동매매/신호 스캔 서비스입니다. 7일 무료 모의투자로 먼저 체험해 보세요.',
    buttonText: '모의투자로 체험하기',
    link: 'http://158.101.145.224:5000/',
    disclaimer: '모의투자 먼저 이용을 권장합니다. 투자에는 원금 손실 위험이 있으며 수익을 보장하지 않습니다. 토스증권 공식 서비스가 아닙니다.',
  },
];

export default function HouseAds() {
  return (
    <div className="mt-16 pt-12 border-t border-gray-200">
      {/* 섹션 제목 및 보조 문구 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2">
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            운영자의 다른 서비스
          </h3>
          <span className="bg-brand-orange/10 text-brand-orange text-xs font-bold px-2.5 py-1 rounded-full">
            무료로 먼저 써보세요
          </span>
        </div>
      </div>

      {/* 카드 3개 목록 (PC 3열, 모바일 1열) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {HOUSE_ADS.map((ad) => (
          <a
            key={ad.id}
            href={ad.link}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group flex flex-col justify-between bg-white rounded-3xl p-6 border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left"
          >
            <div>
              {/* 상단 뱃지 및 외부 링크 아이콘 */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-green/10 text-brand-green">
                  {ad.category}
                </span>
                <ExternalLink
                  size={15}
                  className="text-gray-400 group-hover:text-brand-orange transition-colors"
                />
              </div>

              {/* 서비스 제목 */}
              <h4 className="text-base md:text-lg font-bold text-gray-900 mb-2.5 group-hover:text-brand-orange transition-colors leading-snug">
                {ad.title}
              </h4>

              {/* 서비스 설명 문구 */}
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed mb-4">
                {ad.description}
              </p>

              {/* 필수 고지 사항 (AutoTrader Pro 전용) */}
              {ad.disclaimer && (
                <div className="mb-4 p-2.5 rounded-xl bg-gray-50 border border-gray-200/70 text-[11px] text-gray-400 leading-relaxed">
                  {ad.disclaimer}
                </div>
              )}
            </div>

            <div className="mt-2">
              {/* 액션 버튼 */}
              <div className="w-full py-2.5 px-4 rounded-xl bg-brand-green text-white text-xs md:text-sm font-bold text-center group-hover:bg-brand-orange transition-colors duration-200 flex items-center justify-center gap-1.5 shadow-sm">
                <span>{ad.buttonText}</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">➔</span>
              </div>

              {/* 하단 고지 문구 */}
              <p className="text-center text-[11px] text-gray-400 mt-3 pt-2.5 border-t border-gray-100">
                운영자가 직접 운영하는 서비스입니다
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
