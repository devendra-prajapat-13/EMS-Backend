const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HolidaySchema = new Schema({
    holidayName: { type: String, required: true, trim: true },
    holidayDate: { type: Date, required: true, unique: true },
    holidayType: {
        type: String,
        enum: ['Festival', 'National', 'Company Holiday', 'Optional Holiday'],
        required: true
    },
    description: { type: String, default: '', trim: true },
    isPaid: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', HolidaySchema);
