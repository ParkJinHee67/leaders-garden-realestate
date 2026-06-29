import { Link } from 'react-router-dom';
import { Phone, Menu } from 'lucide-react';
import { useSiteSettings } from '../context/SiteContext';

export default function Header() {
  const siteSettings = useSiteSettings();
  const name = siteSettings?.name || '리더스가든 부동산';
  const phone = siteSettings?.phone || '010-4630-0363';

  const handleResetHome = (e) => {
    sessionStorage.removeItem('filter_property_type');
    sessionStorage.removeItem('filter_transaction_type');
    sessionStorage.removeItem('filter_verification_type');
    sessionStorage.removeItem('filter_expiry');
    sessionStorage.removeItem('filter_keyword');
    sessionStorage.removeItem('home_scroll_y');
    
    if (window.location.pathname === '/') {
      e.preventDefault();
      // 커스텀 이벤트를 발생시켜 Home 컴포넌트의 React 상태를 초기화합니다.
      window.dispatchEvent(new CustomEvent('reset-home-filters'));
      // 최상단으로 즉시 스크롤합니다.
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const handleGoToSearch = (e) => {
    sessionStorage.removeItem('filter_property_type');
    sessionStorage.removeItem('filter_transaction_type');
    sessionStorage.removeItem('filter_verification_type');
    sessionStorage.removeItem('filter_expiry');
    sessionStorage.removeItem('filter_keyword');
    sessionStorage.removeItem('home_scroll_y');
    
    if (window.location.pathname === '/') {
      e.preventDefault();
      // 커스텀 이벤트를 발생시켜 Home 컴포넌트의 React 상태를 초기화합니다.
      window.dispatchEvent(new CustomEvent('reset-home-filters'));
      // 매물 영역(properties)으로 즉시 스크롤합니다.
      const element = document.getElementById('properties');
      if (element) {
        element.scrollIntoView({ behavior: 'auto' });
      }
    } else {
      e.preventDefault();
      // 다른 페이지에서는 플래그를 심어둔 뒤 메인 페이지로 이동시켜, 
      // 메인 컴포넌트가 마운트되고 나서 매물 리스트 위치로 즉시 스크롤하도록 처리합니다.
      sessionStorage.setItem('scroll_to_properties', 'true');
      window.location.href = '/';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" onClick={handleResetHome} className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-green rounded-lg flex items-center justify-center text-white font-bold text-xl">
            {name.charAt(0)}
          </div>
          <span className="font-bold text-xl text-brand-green">{name}</span>
        </Link>
        
        <nav className="hidden md:flex gap-6 text-gray-600 font-medium">
          <Link to="/#properties" onClick={handleGoToSearch} className="hover:text-brand-orange transition">매물검색</Link>
          <a href="https://031-858-4955.asil.kr/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange transition flex items-center gap-1">
            🏘️ 전체매물
          </a>
          <Link to="/gtx" className="text-brand-orange font-bold hover:text-orange-700 transition flex items-center gap-1">
            <span className="animate-pulse">🚀</span> GTX-C 호재
          </Link>
          <a href="https://budongsan-lab.tistory.com/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange transition flex items-center gap-1">
            📝 블로그
          </a>
          <a href="/#about" className="hover:text-brand-orange transition">회사소개</a>
          <a href="/#location" className="hover:text-brand-orange transition">오시는 길</a>
          <Link to="/consult/request" className="hover:text-brand-orange transition">상담 신청</Link>
          <Link to="/consult/view" className="hover:text-brand-orange transition">상담 내역 조회</Link>
          <Link to="/admin" className="text-brand-green hover:text-brand-orange transition font-bold">Admin</Link>
        </nav>

        <div className="flex items-center gap-4">
          <a href={`tel:${phone}`} className="hidden md:flex items-center gap-2 bg-brand-orange text-white px-4 py-2 rounded-full font-bold hover:bg-orange-700 transition shadow-md">
            <Phone size={18} />
            상담문의
          </a>
          <button className="md:hidden text-gray-600">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
