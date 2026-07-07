const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSalarySchema = new Schema({
    employeeID: {type: Schema.Types.ObjectId, ref: 'User', required: true},
    salary: {type: Number, required: true, min: 1},
    bonus: {type: Number, default: 0, min: 0},
    reasonForBonus: {type: String, default: 'N/A', minlength: 3, maxlength: 100},
    assignedDate: {type: String, required: true}
});


module.exports = mongoose.model('UserSalary', UserSalarySchema);
