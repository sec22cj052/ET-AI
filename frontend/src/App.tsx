import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Ingestion from './pages/Ingestion';
import Copilot from './pages/Copilot';
import KnowledgeGraph from './pages/KnowledgeGraph';
import RCA from './pages/RCA';
import Compliance from './pages/Compliance';
import Lessons from './pages/Lessons';
import Verification from './pages/Verification';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/admin" replace />} />
          <Route path="admin" element={<Ingestion />} />
          <Route path="copilot" element={<Copilot />} />
          <Route path="knowledge-graph" element={<KnowledgeGraph />} />
          <Route path="rca" element={<RCA />} />
          <Route path="compliance" element={<Compliance />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="verification" element={<Verification />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
