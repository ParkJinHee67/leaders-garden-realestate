import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, fullMessage } = await req.json()

    // 환경 변수에서 Solapi 키값 가져오기
    const apiKey = Deno.env.get('SOLAPI_API_KEY');
    const apiSecret = Deno.env.get('SOLAPI_API_SECRET');
    const senderNumber = Deno.env.get('SOLAPI_SENDER_NUMBER');

    if (!apiKey || !apiSecret || !senderNumber) {
      throw new Error("서버에 문자 발송용 API 키가 설정되지 않았습니다.");
    }

    // Solapi 인증 시그니처 생성 (Web Crypto API 사용)
    const date = new Date().toISOString()
    const salt = crypto.randomUUID().replace(/-/g, '')
    
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(date + salt)
    );
    
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const authHeader = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signatureHex}`

    // Solapi 메시지 발송 API 호출
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        message: {
          to: phone.replace(/[^0-9]/g, ''),
          from: senderNumber.replace(/[^0-9]/g, ''),
          text: fullMessage,
          autoTypeDetect: true
        }
      })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`문자 발송 실패: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: '문자가 성공적으로 발송되었습니다.', result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
