import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SiteProvider } from './context/SiteContext';
import Home from './pages/Home';
import PropertyDetail from './pages/PropertyDetail';
import ConsultRequest from './pages/ConsultRequest';
import ConsultCheck from './pages/ConsultCheck';
import AdminDashboard from './pages/AdminDashboard';
import GtxInfo from './pages/GtxInfo';
import Diagnostics from './pages/Diagnostics';

function App() {
  return (
    <SiteProvider>
      <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/consult/request" element={<ConsultRequest />} />
        <Route path="/consult/view" element={<ConsultCheck />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/gtx" element={<GtxInfo />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
      </Routes>
    </Router>
    </SiteProvider>
  );
}

export default App;
