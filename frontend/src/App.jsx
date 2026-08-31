import NavBar from "./components/NavBar";
import BasketHomepage from "./components/BasketHomePage";
import BasketContent from "./components/BasketContent";
import { useEffect, useState } from "react";
import { Navigate, Routes, Route } from 'react-router-dom';

const App = () => {
  const [baskets, setBaskets] = useState(['Basket to test display and redirect']);

  useEffect(() => {
    const getBaskets = async () => {
      // const allBaskets = await services.getBaskets();
      // setBaskets(allBaskets)
    };

    getBaskets();
  });

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Navigate to="/web" replace />} />
        <Route path="/web" element={<BasketHomepage baskets={baskets} setBaskets={setBaskets} />} />
        <Route path="/web/:basket" element={<BasketContent />}/>
      </Routes>
    </>
  );
};

export default App;
