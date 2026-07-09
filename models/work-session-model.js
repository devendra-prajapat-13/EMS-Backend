const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WorkSessionSchema = new Schema({
    employeeID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    dateKey: { type: String, required: true },
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date, required: false },
    durationMinutes: { type: Number, default: 0 }
});

WorkSessionSchema.index({ employeeID: 1, dateKey: 1, loginTime: 1 });

module.exports = mongoose.model('WorkSession', WorkSessionSchema);
