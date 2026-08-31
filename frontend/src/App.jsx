import { Routes, Route, Navigate } from "react-router-dom";
import BasketPage from "./components/BasketPage";
import HomePage from "./components/HomePage";

const App = () => {
  return (
    <Routes>
      <Route path="/web" element={<HomePage />} />
      <Route path="/web/:basketName" element={<BasketPage />} />

      <Route path="/" element={<Navigate to="/web" replace />} />
    </Routes>
  );
};

export default App;
