import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // 다음 렌더링에서 폴백 UI가 보이도록 상태를 업데이트 합니다.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 에러 리포팅 서비스에 에러를 기록할 수도 있습니다.
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI를 렌더링할 수 있습니다.
      return (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex flex-col items-center justify-center text-center">
          <p className="font-bold mb-2">지도를 불러올 수 없습니다.</p>
          <p className="text-sm opacity-80">네이버 지도 API 키(.env)를 확인해주세요.</p>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
