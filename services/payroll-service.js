const User = require('../models/user-model');
const Attendance = require('../models/attendance-model');
const Leave = require('../models/leave-model');
const UserSalary = require('../models/user-salary');
const Payroll = require('../models/payroll-model');

const PAID_LEAVE_TYPES = ['paid leave', 'sick leave', 'casual leave', 'emergency leave', 'early leave'];
const UNPAID_LEAVE_TYPES = ['unpaid leave', 'lop', 'loss of pay'];

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateString = (value) => {
    const parts = String(value || '').trim().split('-');
    if(parts.length !== 3) return '';
    const [year, month, day] = parts;
    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const getCalendarDaysForMonth = (month, year) => {
    const days = [];
    const date = new Date(year, month - 1, 1);
    while(date.getMonth() === month - 1) {
        days.push(formatDateKey(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
};

const getMonthIndex = (month, year) => (year * 12) + month;

const getJoiningDate = (employee) => employee.joiningDate || employee.createdAt || new Date();

const getLeaveTypeQuery = () => ({
    $in: ['Paid Leave', 'Sick Leave', 'Casual Leave', 'Emergency Leave', 'Early Leave']
});

const getDateKeysBetween = (startDate, endDate, month, year) => {
    const start = normalizeDateString(startDate);
    const end = normalizeDateString(endDate);
    if(!start || !end) return [];

    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const cursor = new Date(startYear, startMonth - 1, startDay);
    const last = new Date(endYear, endMonth - 1, endDay);
    const keys = [];

    while(cursor <= last) {
        const isSelectedMonth = cursor.getFullYear() === year && cursor.getMonth() === month - 1;
        if(isSelectedMonth) keys.push(formatDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return keys;
};

const addLeaveDates = (targetSet, leaves, month, year) => {
    leaves.forEach((leave) => {
        getDateKeysBetween(leave.startDate, leave.endDate, month, year).forEach((dateKey) => {
            targetSet.add(dateKey);
        });
    });
};

const countLeaveDays = (leaveSet) => leaveSet.size;

class PayrollService {
    getMonthlyPaidLeaveAllocation = (monthsFromJoining) => monthsFromJoining % 3 === 2 ? 2 : 1;

    getEmployeeBaseSalary = async (employeeID) => {
        const salary = await UserSalary.findOne({ employeeID }).sort({ assignedDate: -1, _id: -1 });
        return salary ? Number(salary.salary) : 0;
    };

    calculateLeaveBalance = async (employee, month, year) => {
        const employeeID = employee._id;
        const joiningDate = getJoiningDate(employee);
        const joiningMonth = joiningDate.getMonth() + 1;
        const joiningYear = joiningDate.getFullYear();
        const joiningIndex = getMonthIndex(joiningMonth, joiningYear);
        const selectedIndex = getMonthIndex(month, year);
        let balance = 0;
        let carryForwardLeave = 0;
        let paidLeaveUsed = 0;
        let paidLeaveRequested = 0;
        let monthlyAllocation = 0;
        let availableLeaveBefore = 0;

        if(selectedIndex < joiningIndex) {
            return {
                monthlyAllocation: 0,
                carryForwardLeave: 0,
                availableLeaveBefore: 0,
                paidLeaveRequested: 0,
                paidLeaveUsed: 0,
                paidLeaveBalance: 0,
                remainingLeaveBalance: 0,
                paidLeaveShortfall: 0
            };
        }

        const paidLeaves = await Leave.find({
            applicantID: employeeID,
            adminResponse: 'Approved',
            type: getLeaveTypeQuery()
        });

        for(let currentIndex = joiningIndex; currentIndex <= selectedIndex; currentIndex += 1) {
            const currentYear = Math.floor((currentIndex - 1) / 12);
            const currentMonth = currentIndex - (currentYear * 12);
            const monthsFromJoining = currentIndex - joiningIndex;
            carryForwardLeave = balance;
            monthlyAllocation = this.getMonthlyPaidLeaveAllocation(monthsFromJoining);
            availableLeaveBefore = carryForwardLeave + monthlyAllocation;
            const paidLeaveSet = new Set();
            addLeaveDates(paidLeaveSet, paidLeaves, currentMonth, currentYear);
            paidLeaveRequested = countLeaveDays(paidLeaveSet);
            paidLeaveUsed = Math.min(availableLeaveBefore, paidLeaveRequested);
            balance = availableLeaveBefore - paidLeaveUsed;
        }

        return {
            monthlyAllocation,
            carryForwardLeave,
            availableLeaveBefore,
            paidLeaveRequested,
            paidLeaveUsed,
            paidLeaveBalance: balance,
            remainingLeaveBalance: balance,
            paidLeaveShortfall: Math.max(0, paidLeaveRequested - paidLeaveUsed)
        };
    };

    calculateEmployeePayroll = async (employee, month, year, persistedPayroll = null) => {
        const monthDayKeys = getCalendarDaysForMonth(month, year);
        const monthDaySet = new Set(monthDayKeys);
        const totalDaysInMonth = monthDayKeys.length;
        const monthlySalary = await this.getEmployeeBaseSalary(employee._id);

        const approvedLeaves = await Leave.find({ applicantID: employee._id, adminResponse: 'Approved' });
        const paidLeaveSet = new Set();
        const unpaidLeaveSet = new Set();
        approvedLeaves.forEach((leave) => {
            const leaveType = normalizeText(leave.type);
            if(leaveType === 'work from home') return;
            if(PAID_LEAVE_TYPES.includes(leaveType)) addLeaveDates(paidLeaveSet, [leave], month, year);
            if(UNPAID_LEAVE_TYPES.includes(leaveType)) addLeaveDates(unpaidLeaveSet, [leave], month, year);
        });

        const leaveDaySet = new Set([...paidLeaveSet, ...unpaidLeaveSet]);
        const attendance = await Attendance.find({ employeeID: employee._id, month, year, present: true });
        const presentSet = new Set();
        const wfhSet = new Set();
        attendance.forEach((record) => {
            const dateKey = `${record.year}-${String(record.month).padStart(2, '0')}-${String(record.date).padStart(2, '0')}`;
            if(!monthDaySet.has(dateKey) || leaveDaySet.has(dateKey)) return;
            presentSet.add(dateKey);
            if(record.mode === 'Work From Home') wfhSet.add(dateKey);
        });

        const leaveBalance = await this.calculateLeaveBalance(employee, month, year);
        const paidLeaveRequested = leaveBalance.paidLeaveRequested;
        const paidLeaveUsed = leaveBalance.paidLeaveUsed;
        const explicitUnpaidLeave = countLeaveDays(unpaidLeaveSet);
        const unpaidLeave = explicitUnpaidLeave + leaveBalance.paidLeaveShortfall;
        const leaveTaken = paidLeaveRequested + explicitUnpaidLeave;
        let absentDays = 0;
        monthDaySet.forEach((dateKey) => {
            if(!presentSet.has(dateKey) && !leaveDaySet.has(dateKey)) {
                absentDays += 1;
            }
        });

        const lopDays = unpaidLeave + absentDays;
        const payableDays = presentSet.size + paidLeaveUsed;
        const perDaySalary = totalDaysInMonth > 0 ? roundMoney(monthlySalary / totalDaysInMonth) : 0;
        const salaryDeduction = roundMoney(perDaySalary * lopDays);
        const finalSalary = roundMoney(Math.max(0, monthlySalary - salaryDeduction));

        return {
            payrollID: persistedPayroll && persistedPayroll._id,
            employeeID: employee._id,
            employeeName: employee.name,
            department: employee.team && employee.team.name ? employee.team.name : 'N/A',
            designation: employee.type,
            month,
            year,
            monthlySalary,
            workingDays: totalDaysInMonth,
            totalDaysInMonth,
            presentDays: presentSet.size,
            wfhDays: wfhSet.size,
            leaveTaken,
            availableLeaveBefore: leaveBalance.availableLeaveBefore,
            paidLeaveUsed,
            paidLeaveBalance: leaveBalance.paidLeaveBalance,
            remainingLeaveBalance: leaveBalance.remainingLeaveBalance,
            carryForwardLeave: leaveBalance.carryForwardLeave,
            monthlyLeaveAllocation: leaveBalance.monthlyAllocation,
            unpaidLeave,
            absentDays,
            lopDays,
            payableDays,
            perDaySalary,
            salaryDeduction,
            finalSalary,
            status: persistedPayroll ? persistedPayroll.status : 'Calculated',
            paymentDate: persistedPayroll ? persistedPayroll.paymentDate : undefined,
            paymentMethod: persistedPayroll && persistedPayroll.paymentMethod ? persistedPayroll.paymentMethod : 'N/A',
            paymentRemarks: persistedPayroll && persistedPayroll.paymentRemarks ? persistedPayroll.paymentRemarks : ''
        };
    };

    getPayrollSummary = async ({ month, year, employeeID }) => {
        const filter = employeeID ? { _id: employeeID } : { type: { $in: ['employee', 'leader'] } };
        const employees = await User.find(filter).populate('team');
        const payrolls = await Payroll.find({ month, year });
        const payrollMap = {};
        payrolls.forEach((payroll) => {
            payrollMap[String(payroll.employeeID)] = payroll;
        });

        const rows = [];
        for(const employee of employees) {
            rows.push(await this.calculateEmployeePayroll(employee, month, year, payrollMap[String(employee._id)]));
        }

        const totals = rows.reduce((acc, row) => {
            acc.totalEmployees += 1;
            acc.totalPayrollAmount += row.monthlySalary;
            acc.totalSalaryDeduction += row.salaryDeduction;
            acc.totalAmountToPay += row.finalSalary;
            acc.totalPaidLeaveUsed += row.paidLeaveUsed;
            acc.totalLopDays += row.lopDays;
            return acc;
        }, {
            totalEmployees: 0,
            totalPayrollAmount: 0,
            totalSalaryDeduction: 0,
            totalAmountToPay: 0,
            totalPaidLeaveUsed: 0,
            totalLopDays: 0
        });

        totals.totalPayrollAmount = roundMoney(totals.totalPayrollAmount);
        totals.totalSalaryDeduction = roundMoney(totals.totalSalaryDeduction);
        totals.totalAmountToPay = roundMoney(totals.totalAmountToPay);

        return { rows, totals };
    };

    generatePayroll = async ({ month, year, regenerate = false }) => {
        const { rows } = await this.getPayrollSummary({ month, year });
        const generated = [];
        const skipped = [];

        for(const row of rows) {
            const existing = await Payroll.findOne({ employeeID: row.employeeID, month, year });
            if(existing && !regenerate) {
                skipped.push(row);
                continue;
            }

            const data = {
                ...row,
                status: existing && existing.status === 'Paid' ? 'Paid' : 'Pending',
                paymentMethod: existing && existing.paymentMethod ? existing.paymentMethod : 'N/A',
                paymentRemarks: existing && existing.paymentRemarks ? existing.paymentRemarks : '',
                updatedAt: new Date()
            };
            if(existing && existing.paymentDate) data.paymentDate = existing.paymentDate;
            else delete data.paymentDate;
            delete data.payrollID;
            delete data.monthlyLeaveAllocation;

            const payroll = await Payroll.findOneAndUpdate(
                { employeeID: row.employeeID, month, year },
                data,
                { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
            );
            generated.push(payroll);
        }

        return { generated, skipped };
    };

    markSalaryPaid = async ({ employeeID, month, year, paymentDate, paymentMethod, paymentRemarks }) => {
        const payroll = await Payroll.findOne({ employeeID, month, year });
        if(!payroll) return null;

        payroll.status = 'Paid';
        payroll.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
        payroll.paymentMethod = paymentMethod || 'N/A';
        payroll.paymentRemarks = paymentRemarks || '';
        payroll.updatedAt = new Date();
        return payroll.save();
    };

    getEmployeePayrollHistory = async (employeeID) =>
        Payroll.find({ employeeID }).sort({ year: -1, month: -1 });
}

module.exports = new PayrollService();
