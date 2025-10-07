import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    department: {
        type: String,
        required: true,
    },
    appointmentDate: {
        type: Date,
        required: true,
    },
    reason: {
        type: String,
        default: 'Not specified',
    },
    originalQuery: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Confirmed', 'Cancelled'],
        default: 'Pending',
    }
}, { timestamps: true });  

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
