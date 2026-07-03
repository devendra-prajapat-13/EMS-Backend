const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LeaveSchema = new Schema({

    applicantID: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    title: {type: String, required: true},
    type: {type: String, required: true},
    startDate: {type: String, required: true},
    endDate: {type: String, required: true},
    appliedDate: {type: String, required: true},
    period: {type: Number, required: true, min: 1, max: 10},
    reason: {type: String, required: true},
    adminResponse: {type: String, default: 'N/A'},

    // Approver metadata: who approved/rejected and when
    approverID: {type: Schema.Types.ObjectId, ref: 'User', required: false},
    approverRole: {type: String, enum:['admin','leader'], required:false},
    approverName: {type: String, required:false, default:'N/A'},
    approverDate: {type: String, required:false, default:''}

});


module.exports = mongoose.model('Leave', LeaveSchema);
