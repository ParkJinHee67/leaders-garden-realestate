import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../supabaseClient';
import emailjs from '@emailjs/browser';
import { useSiteSettings } from '../context/SiteContext';

export default function ConsultRequest() {
  const siteSettings = useSiteSettings();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    type: '매매',
    content: ''
  });
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submit button clicked!");
    setFeedbackMsg({ type: '', text: '' });
    
    if (!agreePrivacy) {
      setFeedbackMsg({ type: 'error', text: '개인정보 수집 및 이용에 동의해주세요.' });
      return;
    }
    setLoading(true);

    try {
      if (!supabase) {
        // DB 연결 전 테스트를 위한 로컬 스토리지 저장
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        localData.push({
          id: Date.now(),
          ...formData,
          status: '대기중',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('consultations', JSON.stringify(localData));
      } else {
        // 1. Supabase DB에 저장
        const { error } = await supabase
          .from('consultations')
          .insert([{ 
            name: formData.name, 
            phone: formData.phone, 
            type: formData.type, 
            content: formData.content,
            status: '대기중'
          }]);

        if (error) throw error;
      }


      console.log("DB insert successful, checking emailjs...");
      // 2. 소장님께 이메일 알림 발송 (EmailJS)
      const emailServiceId = siteSettings?.emailjs_service_id || import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const emailTemplateId = siteSettings?.emailjs_template_id || import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const emailPublicKey = siteSettings?.emailjs_public_key || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      const targetEmail = siteSettings?.email || 'jhpa670211@gmail.com';

      if (emailServiceId && emailTemplateId) {
        await emailjs.send(
          emailServiceId,
          emailTemplateId,
          {
            to_email: targetEmail,
            customer_name: formData.name,
            customer_phone: formData.phone,
            consult_type: formData.type,
            message: formData.content
          },
          emailPublicKey
        );
      }

      // 3. 소장님께 실시간 문자 알림 발송 (Solapi)
      const targetPhone = siteSettings?.notification_phone || siteSettings?.phone || '010-4630-0363';
      if (supabase && targetPhone) {
        const smsMessage = `[신규 상담 신청]\n성함: ${formData.name}\n연락처: ${formData.phone}\n유형: ${formData.type}\n내용: ${formData.content.substring(0, 45)}`;
        
        supabase.functions.invoke('send-reply-sms', {
          body: { phone: targetPhone, fullMessage: smsMessage }
        }).then(({ error: smsErr }) => {
          if (smsErr) console.error("상담 신청 문자 알림 실패:", smsErr);
          else console.log("상담 신청 문자 알림 발송 성공!");
        }).catch(err => {
          console.error("문자 알림 전송 오류:", err);
        });
      }

      console.log("Success! Navigating...");
      setFeedbackMsg({ type: 'success', text: '상담 신청이 완료되었습니다! 잠시 후 메인으로 이동합니다.' });
      setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      console.error("Submit error details:", error);
      setFeedbackMsg({ type: 'error', text: "오류가 발생했습니다: " + (error.message || JSON.stringify(error)) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-2xl">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 신청</h1>
          <p className="text-gray-500 mb-8">리더스가든 부동산에 문의를 남겨주시면 빠르게 답변해 드립니다.</p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">성함</label>
              <input 
                type="text" required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none"
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">연락처 (숫자만)</label>
              <input 
                type="tel" required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none"
                value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="예: 01012345678"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">상담 유형</label>
              <select 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none"
                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="매매">매매</option>
                <option value="전세">전세</option>
                <option value="월세">월세</option>
                <option value="분양">분양/투자</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">문의 내용</label>
              <textarea 
                required rows="5"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none resize-none"
                value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})}
                placeholder="찾으시는 조건이나 궁금하신 점을 자유롭게 적어주세요."
              ></textarea>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="mt-1 w-5 h-5 text-brand-orange rounded border-gray-300 focus:ring-brand-orange"
                  checked={agreePrivacy}
                  onChange={e => setAgreePrivacy(e.target.checked)}
                />
                <div className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">[필수] 개인정보 수집 및 이용 동의</span>
                  <p className="mt-1 text-gray-500 text-xs leading-relaxed">
                    리더스가든 부동산은 상담을 위해 아래와 같이 개인정보를 수집 및 이용합니다.<br/>
                    - 수집항목: 성함, 연락처<br/>
                    - 이용목적: 매물 상담 및 관련 안내<br/>
                    - 보유기간: 상담 완료 후 6개월 보관 후 파기
                  </p>
                </div>
              </label>
            </div>
            
            {feedbackMsg.text && (
              <div className={`p-4 rounded-xl font-bold ${feedbackMsg.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                {feedbackMsg.text}
              </div>
            )}
            
            <button 
              type="submit" disabled={loading}
              className="w-full bg-brand-orange text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition disabled:opacity-50"
            >
              {loading ? '접수 중...' : '상담 신청하기'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
