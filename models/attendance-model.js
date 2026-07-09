const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AttendanceSchema = new Schema({
    employeeID: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    year: {type: Number, required: true},
    month: {type: Number, required: true},
    date: {type: Number, required: true},
    day: {type: String, required: true},
    present: {type: Boolean, required: true},
    status: {type: String, enum: ['Present', 'Half Day', 'WFH', 'Leave', 'Absent'], default: 'Present'},
    checkInTime: {type: Date, required: false},
    mode: {type: String, enum: ['Office', 'Work From Home'], default: 'Office'},
    latitude: {type: Number, required: false},
    longitude: {type: Number, required: false},
    distanceFromOffice: {type: Number, required: false},
});

AttendanceSchema.index({ employeeID: 1, year: 1, month: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
