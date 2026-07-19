import express from 'express';
import cors from 'cors';
import ticketRoutes from './routes/ticketRoutes';
import userRoutes from './routes/userRoutes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', ticketRoutes);
app.use('/api', userRoutes);

app.use(errorHandler);

export default app;
