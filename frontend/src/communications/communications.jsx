import axios from "axios";

const baseURL = '/api';
const tokenKey = (name) => `basket_${name}`;
const readTokens = () => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY)) || {};
  } catch {
    return {};
  }
};
const saveToken = (name, token) => {
  localStorage.setItem(tokenKey(name), token);
};
const getToken = (name) => localStorage.getItem(tokenKey(name));

const getNewBasketName = async () => {
  try {
    const newBasketName = await axios.get(`${baseURL}/new-basket`);
    return newBasketName.data;
  } catch (error) {
    console.error(error.message);
  }
};

// ▶ NEW //(replaces getNewBaskets)
const listBaskets = () =>                                      
  Object.keys(localStorage)
    .filter((k) => k.startsWith("basket_"))
    .map((k) => ({name: k.slice("basket_".length) }));

const createBasket = async (basketName) => {
  const res = await axios.post(`${baseURL}/baskets/${basketName}`);
  saveToken(basketName, res.data.token);
  return res.data
};

const getBasketRequests = async (basketName, tokenOverride) => {
  const token = tokenOverride || getToken(basketName);
  const headers = token ? { Authorization: `Bearer ${token}`} : {};

  try {
    const response = await axios.get(`${baseURL}/baskets/${basketName}/requests`, { headers });

    if (tokenOverride) saveToken(basketName, tokenOverride);
    return {ok: true, data: response.data};
  } catch (error) {
    return {ok: false, status: error.response?.status, data: error.response?.data};
  }
};

export default {
  getToken,
  saveToken,
  getNewBasketName,
  listBaskets,
  createBasket,
  getBasketRequests,
}