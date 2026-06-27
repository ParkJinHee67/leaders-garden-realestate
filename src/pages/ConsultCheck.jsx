import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../supabaseClient';
import { Search } from 'lucide-react';

export default function ConsultCheck() {
  const [searchParams, setSearchParams] = useState({ name: '', phone: '' });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!supabase) {
        // DB 연결 전 테스트를 위한 로컬 스토리지 조회
        const localData = JSON.parse(localStorage.getItem('consultations') || '[]');
        const filtered = localData.filter(item => item.name === searchParams.name && item.phone === searchParams.phone);
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setResults(filtered);
      } else {
        const { data, error } = await supabase
          .from('consultations')
          .select('*')
          .eq('name', searchParams.name)
          .eq('phone', searchParams.phone)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setResults(data);
      }
    } catch (error) {
      console.error(error);
      alert("조회 중 오류가 발생했습니다: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-12 max-w-3xl">
        <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상담 내역 조회</h1>
          <p className="text-gray-500 mb-8">상담 신청 시 입력하신 성함과 연락처로 내역을 조회할 수 있습니다.</p>
          
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" placeholder="성함" required
              className="flex-grow px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange outline-none"
              value={searchParams.name} onChange={e => setSearchParams({...searchParams, name: e.target.value})}
            />
            <input 
              type="tel" placeholder="연락처 (숫자만)" required
              className="flex-grow px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-brand-orange outline-none"
              value={searchParams.phone} onChange={e => setSearchParams({...searchParams, phone: e.target.value})}
            />
            <button 
              type="submit" disabled={loading}
              className="bg-brand-green text-white px-8 py-3 rounded-xl font-bold hover:bg-green-800 transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Search size={20} />
              {loading ? '조회 중...' : '조회하기'}
            </button>
          </form>
        </div>

        {results && (
          <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold mb-6">조회 결과 ({results.length}건)</h2>
            {results.length === 0 ? (
              <p className="text-center text-gray-500 py-10">조회된 상담 내역이 없습니다.</p>
            ) : (
              <div className="space-y-6">
                {results.map(item => (
                  <div key={item.id} className="border border-gray-200 rounded-2xl p-6 relative">
                    <span className={`absolute top-6 right-6 px-3 py-1 rounded-full text-sm font-bold ${item.status === '답변완료' ? 'bg-brand-green text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {item.status}
                    </span>
                    <div className="mb-4">
                      <span className="text-sm text-brand-orange font-bold mr-3">[{item.type}]</span>
                      <span className="text-gray-400 text-sm">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap mb-4 font-medium">{item.content}</p>
                    
                    {item.reply && (
                      <div className="mt-4 bg-gray-50 p-4 rounded-xl border-l-4 border-brand-orange">
                        <p className="text-sm font-bold text-brand-orange mb-2">소장님 답변</p>
                        <p className="text-gray-700 whitespace-pre-wrap">{item.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
