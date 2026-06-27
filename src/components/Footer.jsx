import { useSiteSettings } from '../context/SiteContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const siteSettings = useSiteSettings();
  const name = siteSettings?.name || '리더스가든 부동산';
  const address = siteSettings?.address || '경기도 양주시 옥정로';
  const ceo = siteSettings?.ceo_name || '유현휘';
  const phone = siteSettings?.phone || '010-4630-0363';
  const registrationNumber = siteSettings?.registration_number || '123-45-67890';
  
  const hoursWeekday = siteSettings?.hours_weekday || '09:00 ~ 19:00';
  const hoursSaturday = siteSettings?.hours_saturday || '09:00 ~ 17:00';
  const hoursSunday = siteSettings?.hours_sunday || '휴무 (사전 예약 시 상담 가능)';
  const hoursHoliday = siteSettings?.hours_holiday || '휴무 (사전 예약 시 상담 가능)';
  const noticeText = siteSettings?.notice_text || '';

  return (
    <footer className="bg-brand-green text-white py-12 mt-20">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4">{name}</h3>
            <p className="text-gray-300 leading-relaxed mb-2">{address}</p>
            <p className="text-gray-300 leading-relaxed mb-2">대표: {ceo}</p>
            <p className="text-gray-300 leading-relaxed mb-2">등록번호: {registrationNumber}</p>
          </div>
          <div className="md:text-right">
            <h3 className="text-xl font-bold mb-4">고객센터</h3>
            <p className="text-3xl font-bold text-brand-orange mb-2">{phone}</p>
            <div className="text-gray-300 text-sm space-y-1 mb-4">
              <p>평일 : {hoursWeekday}</p>
              <p>토요일 : {hoursSaturday}</p>
              <p>일요일 : {hoursSunday}</p>
              <p>공휴일 : {hoursHoliday}</p>
            </div>
            {noticeText && (
              <div className="inline-block bg-brand-orange/20 text-brand-orange px-3 py-2 rounded-lg text-sm font-bold border border-brand-orange/30">
                📢 {noticeText}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-green-800 mt-8 pt-8 text-center text-gray-400 text-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© 2026 Readers Garden Realty. All rights reserved.</div>
          <div>
            <Link to="/diagnostics" className="hover:text-white text-gray-300 font-bold transition text-xs flex items-center gap-1 bg-green-900/40 hover:bg-green-900 px-3 py-1.5 rounded-lg border border-green-800/80">
              🛠️ 시스템 상태 진단 및 자가 해결
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
