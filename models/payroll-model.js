const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PayrollSchema = new Schema({
    employeeID: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    employeeName: { type: String, required: true },
    department: { type: String, default: 'N/A' },
    designation: { type: String, default: 'Employee' },
    monthlySalary: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    pfPercentage: { type: Number, default: 0 },
    pfAmount: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    totalDaysInMonth: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    halfDayDeduction: { type: Number, default: 0 },
    wfhDays: { type: Number, default: 0 },
    leaveTaken: { type: Number, default: 0 },
    availableLeaveBefore: { type: Number, default: 0 },
    paidLeaveUsed: { type: Number, default: 0 },
    paidLeaveBalance: { type: Number, default: 0 },
    remainingLeaveBalance: { type: Number, default: 0 },
    paidHolidayDays: { type: Number, default: 0 },
    carryForwardLeave: { type: Number, default: 0 },
    unpaidLeave: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    totalPaidDays: { type: Number, default: 0 },
    workingHours: { type: Number, default: 0 },
    workingHoursDeduction: { type: Number, default: 0 },
    perDaySalary: { type: Number, default: 0 },
    salaryDeduction: { type: Number, default: 0 },
    finalSalary: { type: Number, default: 0 },
    status: { type: String, enum: ['Calculated', 'Pending', 'Paid'], default: 'Pending' },
    paymentDate: { type: Date, required: false },
    paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'N/A'], default: 'N/A' },
    paymentRemarks: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

PayrollSchema.index({ employeeID: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', PayrollSchema);
