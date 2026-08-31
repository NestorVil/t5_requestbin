import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 80;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  console.log('test');
});

app.listen(PORT, () => {
  console.log('Server running on ', PORT);
});