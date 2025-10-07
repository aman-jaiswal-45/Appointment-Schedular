import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import appointmentRoutes from './routes/appointment_route.js';

dotenv.config();

connectDB();

const app = express(); 

app.use(express.json());
app.use('/api', appointmentRoutes);

app.get('/', (req, res) => {
    res.send('AI Appointment Schedular API is running...');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 