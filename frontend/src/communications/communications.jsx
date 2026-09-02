import axios from "axios";

const baseURL = '/api';

const getNewBasketName = async () => {
  try {
    const newBasketName = await axios.get(`${baseURL}/new-basket`);
    return newBasketName.data;
  } catch (error) {
    console.error(error.message);
  }
};

const getNewBaskets = async () => {
  try {
    const newBaskets = await axios.get(`${baseURL}/baskets`)
    return newBaskets.data;
  } catch (error) {
    console.error(error.message);
  }
};

const createBasket = async (basketName) => {
  try {
    await axios.post(`${baseURL}/baskets/${basketName}`);
  } catch (error) {
    alert(error.message.data.message);
    console.error(error.message);
  }
};

const getBasketRequests = async (basketName) => {
  try {
    const response = await axios.get(`${baseURL}/baskets/${basketName}/requests`)
    return response.data;
  } catch (error) {
    console.error(error.message);
  }
};

export default {
  getNewBasketName,
  getNewBaskets,
  createBasket,
  getBasketRequests,
}