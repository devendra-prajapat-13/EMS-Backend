const ErrorHandler = require('../utils/error-handler');
const userService = require('../services/user-service');
const UserDto = require('../dtos/user-dto');
const mongoose = require('mongoose');
const LeaveDto = require('../dtos/leave-dto');
const crypto = require('crypto');
const teamService = require('../services/team-service');
const attendanceService = require('../services/attendance-service');
const payrollService = require('../services/payroll-service');

const isValidMobile = (mobile) => /^\d{10}$/.test(String(mobile || ''));
const isPositiveNumber = (value) => Number(value) > 0;
const hasMinLength = (value, length) => String(value || '').trim().length >= length;
const OFFICE_LOCATION = {
    latitude: 22.747667622934507,
    longitude: 75.89663103060164,
    radiusMeters: 100
};

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeDateString = (value) => {
    if(!value) return '';
    const dateText = String(value).trim();
    const parts = dateText.split('-');
    if(parts.length !== 3) return dateText;

    const [year, month, day] = parts;
    if(!year || !month || !day) return dateText;

    return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const ATTENDANCE_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const getActiveWorkforceIds = async () => {
    const users = await userService.findUsers({ type: { $in: ['employee', 'leader'] } });
    return users.map((user) => user._id);
};

const getActiveWorkforceFilter = async (filter = {}, fieldName) => {
    const activeIds = await getActiveWorkforceIds();
    const selectedID = filter[fieldName];

    if(selectedID) {
        const isActive = activeIds.some((id) => String(id) === String(selectedID));
        return isActive ? filter : null;
    }

    return { ...filter, [fieldName]: { $in: activeIds } };
};

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const toRadians = (value) => value * Math.PI / 180;
    const earthRadius = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
};

class UserController {

    createUser = async (req,res,next) =>
    {
        const file = req.file;
        let {name,email,password,type, address, mobile} = req.body;
        const username = 'user'+crypto.randomInt(11111111,999999999);
        if(!name || !email || !username || !password || !type || !address || !file || !mobile) return next(ErrorHandler.badRequest('All Fields Required'));
        if(!isValidMobile(mobile)) return next(ErrorHandler.badRequest('Mobile number must be exactly 10 digits'));
        type = type.toLowerCase();
        if(type==='admin')
        {
            const adminPassword = req.body.adminPassword;
            if(!adminPassword)
                return next(ErrorHandler.badRequest(`Please Enter Your Password to Add ${name} as an Admin`));
            const {_id} = req.user;
            const {password:hashPassword} = await userService.findUser({_id});
            const isPasswordValid = await userService.verifyPassword(adminPassword,hashPassword);
            if(!isPasswordValid) return next(ErrorHandler.unAuthorized('You have entered a wrong password'));
        }
        const user = {
            name,email,username,mobile,password,type,address,image:file.filename
        }

        
        // console.log("Hello! I am here in create user");
        // console.log(user)
        
        const userResp = await userService.createUser(user);
       
        

        if(!userResp) return next(ErrorHandler.serverError('Failed To Create An Account'));
        res.json({success:true,message:'User has been Added',user:new UserDto(user)});
    }

    updateUser = async (req,res,next) =>
    {
        const file = req.file;
        const filename = file && file.filename;
        let user,id;
        console.log(req.user.type);
        if(req.user.type==='admin')
        {
            id = req.params.id;
            let {name,username,email,password,type,status, address, mobile} = req.body;
            type = type && type.toLowerCase();
            status = status && status.toLowerCase();
            if(mobile && !isValidMobile(mobile)) return next(ErrorHandler.badRequest('Mobile number must be exactly 10 digits'));
            if(!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid User Id'));
            if(type)
            {
                const dbUser = await userService.findUser({_id:id});
                if(!dbUser) return next(ErrorHandler.badRequest('No User Found'));
                if(dbUser.type!=type)
                { 
                    const {_id} = req.user;
                    if(_id===id) return next(ErrorHandler.badRequest(`You Can't Change Your Own Position`));
                    const {adminPassword} = req.body;
                    if(!adminPassword)
                        return next(ErrorHandler.badRequest(`Please Enter Your Password To Change The Type`));
                    const {password:hashPassword} = await userService.findUser({_id});
                    const isPasswordValid = await userService.verifyPassword(adminPassword,hashPassword);
                    if(!isPasswordValid) return next(ErrorHandler.unAuthorized('You have entered a wrong password'));
    
                    if((dbUser.type==='employee') && (type==='admin' || type==='leader'))
                        if(dbUser.team!=null) return next(ErrorHandler.badRequest(`Error : ${dbUser.name} is in a team.`));
    
                    if((dbUser.type==='leader') && (type==='admin' || type==='employee'))
                        if(await teamService.findTeam({leader:id})) return next(ErrorHandler.badRequest(`Error : ${dbUser.name} is leading a team.`));
                }
            }
            user = {
                name,email,status,username,mobile,password,type,address,image:filename
            }
        }
        else
        {
            id =  req.user._id;
            let {name,username,address,mobile} = req.body;
            if(mobile && !isValidMobile(mobile)) return next(ErrorHandler.badRequest('Mobile number must be exactly 10 digits'));
            user = {
                name,username,mobile,address,image:filename
            }
        }
        Object.keys(user).forEach((key) => {
            if(user[key] === undefined || (key === 'password' && user[key] === '')) {
                delete user[key];
            }
        });
        // console.log(user);
        const userResp = await userService.updateUser(id,user);
        // console.log(userResp);
        if(!userResp || userResp.matchedCount === 0) return next(ErrorHandler.serverError('Failed To Update Account'));
        res.json({success:true,message:'Account Updated'});
    }

    deleteUser = async (req,res,next) =>
    {
        const {id} = req.params;
        if(!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid User Id'));
        if(String(req.user._id) === String(id)) return next(ErrorHandler.badRequest(`You Can't Delete Your Own Account`));

        const user = await userService.findUser({_id:id});
        if(!user) return next(ErrorHandler.notFound('No User Found'));

        if(user.type === 'leader') {
            await teamService.updateTeams({leader:id},{leader:null});
        }

        const result = await userService.deleteUser(id);
        if(result.deletedCount !== 1) return next(ErrorHandler.serverError('Failed To Delete User'));

        await userService.deleteUserRelatedData(id);
        return res.json({success:true,message:`${user.name} has been deleted`});
    }

    getUsers = async (req,res,next) =>
    {
        const type = req.path.split('/').pop().replace('s','');
        const emps = await userService.findUsers({type});
        if(!emps || emps.length<1) return res.json({success:true,message:`No ${type.charAt(0).toUpperCase()+type.slice(1).replace(' ','')} Found`,data:[]});
        const employees = emps.map((o)=> new UserDto(o));
        res.json({success:true,message:`${type.charAt(0).toUpperCase()+type.slice(1).replace(' ','')} List Found`,data:employees})
    }


    getFreeEmployees = async (req,res,next) =>
    {
        const emps = await userService.findUsers({type:'employee',team:null});
        if(!emps || emps.length<1) return res.json({success:true,message:'No Free Employee Found',data:[]});
        const employees = emps.map((o)=> new UserDto(o));
        res.json({success:true,message:'Free Employees List Found',data:employees})
    }


    getUser = async (req,res,next) =>
    {
        const {id} = req.params;
        const type = req.path.replace(id,'').replace('/','').replace('/','');
        if(!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest(`Invalid ${type.charAt(0).toUpperCase() + type.slice(1).replace(' ','')} Id`));
        const emp = await userService.findUser({_id:id,type});
        if(!emp) return next(ErrorHandler.notFound(`No ${type.charAt(0).toUpperCase() + type.slice(1).replace(' ','')} Found`));
        res.json({success:true,message:'Employee Found',data:new UserDto(emp)})
    }

    getUserNoFilter = async (req,res,next) =>
    {
        const {id} = req.params;
        if(!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid User Id'));
        const emp = await userService.findUser({_id:id});
        if(!emp) return next(ErrorHandler.notFound('No User Found'));
        res.json({success:true,message:'User Found',data:new UserDto(emp)})
    }

    getLeaders = async (req,res,next) =>
    {
        const leaders = await userService.findLeaders();
        const data = leaders.map((o)=>new UserDto(o));
        res.json({success:true,message:'Leaders Found',data})
    }

    getFreeLeaders = async (req,res,next) =>
    {
        const leaders = await userService.findFreeLeaders();
        const data = leaders.map((o)=>new UserDto(o));
        res.json({success:true,message:'Free Leaders Found',data})
    }

    markEmployeeAttendance = async (req,res,next) => {
        try {
        const {employeeID, mode = 'Office', status: requestedStatus, latitude, longitude} = req.body;
        const d = new Date();
        if(!employeeID) return next(ErrorHandler.badRequest('Employee Id Is Required'));
        const status = requestedStatus || (mode === 'Work From Home' ? 'WFH' : 'Present');
        if(!['Present', 'Half Day', 'WFH', 'Leave', 'Absent'].includes(status)) return next(ErrorHandler.badRequest('Invalid attendance status'));
        const attendanceMode = status === 'WFH' ? 'Work From Home' : mode;
        if(!['Office', 'Work From Home'].includes(attendanceMode)) return next(ErrorHandler.badRequest('Invalid attendance mode'));
        let distanceFromOffice;

        if(attendanceMode === 'Office' && ['Present', 'Half Day'].includes(status)) {
            const lat = Number(latitude);
            const lon = Number(longitude);
            if(!Number.isFinite(lat) || !Number.isFinite(lon)) {
                return next(ErrorHandler.badRequest('Location permission is required for office attendance'));
            }

            distanceFromOffice = Math.round(getDistanceInMeters(
                OFFICE_LOCATION.latitude,
                OFFICE_LOCATION.longitude,
                lat,
                lon
            ));

            if(distanceFromOffice > OFFICE_LOCATION.radiusMeters) {
                return next(ErrorHandler.notAllowed(`You are ${distanceFromOffice} meters away from office. Office attendance is allowed within ${OFFICE_LOCATION.radiusMeters} meters.`));
            }
        }

        if(status === 'WFH') {
            const today = formatLocalDate(d);
            const applications = await userService.findAllLeaveApplications({
                applicantID: employeeID,
                type: 'Work From Home'
            });
            const hasApprovedWfh = applications.some((application) => {
                const start = normalizeDateString(application.startDate);
                const end = normalizeDateString(application.endDate);
                const status = normalizeText(application.adminResponse);
                const type = normalizeText(application.type);
                const isApproved = status === 'approved';
                const isWfh = type === 'work from home';
                const isDateInRange = start <= today && today <= end;

                console.log('[Attendance][WFH approval check]', {
                    employeeID,
                    leaveID: application._id,
                    type: application.type,
                    adminResponse: application.adminResponse,
                    startDate: application.startDate,
                    endDate: application.endDate,
                    today,
                    isApproved,
                    isDateInRange
                });

                return isWfh && isApproved && isDateInRange;
            });

            if(!hasApprovedWfh) {
                console.log('[Attendance][WFH approval failed]', {
                    employeeID,
                    today,
                    matchedApplications: applications.length
                });
                return next(ErrorHandler.notAllowed('No approved Work From Home request found for today'));
            }
        }

        // const {_id} = employee;
        
        const newAttendance = {
            employeeID,
            year:d.getFullYear(),
            month:d.getMonth() + 1,
            date:d.getDate(),
            day:ATTENDANCE_DAYS[d.getDay()],
            present: !['Leave', 'Absent'].includes(status), 
            status,
            checkInTime: d,
            mode: attendanceMode,
            latitude,
            longitude,
            distanceFromOffice,
        };

       const isAttendanceMarked = await attendanceService.findAttendance({
            employeeID,
            year:d.getFullYear(),
            month:d.getMonth() + 1,
            date:d.getDate()
       });
       if(isAttendanceMarked) return next(ErrorHandler.notAllowed(d.toLocaleDateString() +" "+ ATTENDANCE_DAYS[d.getDay()]+" "+"Attendance Already Marked!"));

       let resp;
       try {
            resp = await attendanceService.markAttendance(newAttendance);
       }
       catch (error) {
            if(error.code === 11000) return next(ErrorHandler.notAllowed(d.toLocaleDateString() +" "+ ATTENDANCE_DAYS[d.getDay()]+" "+"Attendance Already Marked!"));
            throw error;
       }
       console.log(resp);
       if(!resp) return next(ErrorHandler.serverError('Failed to mark attendance'));

       const msg = d.toLocaleDateString() +" "+ ATTENDANCE_DAYS[d.getDay()] +" "+ `${status} Attendance Marked!`;
       
       res.json({success:true,newAttendance:resp,message:msg});
            
        } catch (error) {
            res.json({success:false,error});    
        } 
    }

    viewEmployeeAttendance = async (req,res,next) => {
        try {
            const data = await getActiveWorkforceFilter(req.body, 'employeeID');
            if(!data) return res.json({success:true,data:[]});
            const resp = await attendanceService.findAllAttendance(data);
            if(!resp) return next(ErrorHandler.notFound('No Attendance found'));

            res.json({success:true,data:resp});
            
        } catch (error) {
            res.json({success:false,error});
        }
    }

    applyLeaveApplication = async (req, res, next) => {
        try {
            const data = req.body;
            const { applicantID, title, type, startDate, endDate, appliedDate, period, reason } = data;
            if(!applicantID || !title || !type || !startDate || !endDate || !appliedDate || !period || !reason) {
                return next(ErrorHandler.badRequest('All Fields Required'));
            }
            if(!hasMinLength(title, 3)) return next(ErrorHandler.badRequest('Title must be at least 3 characters'));
            if(!isPositiveNumber(period)) return next(ErrorHandler.badRequest('Period must be greater than 0'));
            if(new Date(endDate) < new Date(startDate)) return next(ErrorHandler.badRequest('End date cannot be before start date'));
            if(!hasMinLength(reason, 3)) return next(ErrorHandler.badRequest('Reason must be at least 3 characters'));
            const newLeaveApplication = {
                applicantID,
                title,
                type,
                startDate,
                endDate,
                appliedDate, 
                period, 
                reason, 
                adminResponse:"Pending"
            };

            const isLeaveApplied = await userService.findLeaveApplication({applicantID,startDate,endDate,appliedDate});
            if(isLeaveApplied) return next(ErrorHandler.notAllowed('Leave Already Applied'));

            const resp = await userService.createLeaveApplication(newLeaveApplication);
            if(!resp) return next(ErrorHandler.serverError('Failed to apply leave'));

            res.json({success:true,data:new LeaveDto(resp)});

        } catch (error) {
            res.json({success:false,error});   
        }
    }

    viewLeaveApplications = async (req, res, next) => {
        try {
            const data = await getActiveWorkforceFilter(req.body, 'applicantID');
            if(!data) return res.json({success:true,data:[]});
            const resp = await userService.findAllLeaveApplications(data);
            if(!resp) return next(ErrorHandler.notFound('No Leave Applications found'));

            const leaves = resp.map((l)=> new LeaveDto(l));
            res.json({success:true,data:leaves});

        } catch (error) {
            res.json({success:false,error});
        }
    }

    updateLeaveApplication = async (req, res, next) => {
        try {

            const {id} = req.params;
            const body = req.body;
            const existingLeave = await userService.findLeaveApplication({_id: id});
            if(!existingLeave) return next(ErrorHandler.notFound('Leave Application Not Found'));

            console.log('[Leave][update request]', {
                leaveID: id,
                requestedBy: req.user && req.user._id,
                requesterRole: req.user && req.user.type,
                currentStatus: existingLeave.adminResponse,
                nextStatus: body.adminResponse,
                type: existingLeave.type,
                startDate: existingLeave.startDate,
                endDate: existingLeave.endDate
            });

            // Authorization: allow admin to update any leave; allow leader only for their team members
            if(req.user && req.user.type === 'leader'){
                const applicant = await userService.findUser({_id: existingLeave.applicantID});
                if(!applicant) return next(ErrorHandler.notFound('Applicant Not Found'));

                if(!applicant.team) return next(ErrorHandler.unAuthorized('Applicant is not assigned to any team'));

                const team = await teamService.findTeam({_id: applicant.team, leader: req.user._id});
                if(!team) return next(ErrorHandler.unAuthorized('You are not authorized to update this leave'));
            }

            // Attach approver metadata
            if(req.user){
                body.approverID = req.user._id;
                body.approverRole = req.user.type;
                const approver = await userService.findUser({_id: req.user._id});
                if(approver) body.approverName = approver.name;
                body.approverDate = new Date().toISOString();
            }

            const isLeaveUpdated = await userService.updateLeaveApplication(id,body);
            if(!isLeaveUpdated) return next(ErrorHandler.serverError('Failed to update leave'));
            console.log('[Leave][update success]', {
                leaveID: id,
                previousStatus: existingLeave.adminResponse,
                updatedStatus: body.adminResponse
            });
            res.json({success:true,message:'Leave Updated'});
            
            
        } catch (error) {
            res.json({success:false,error});
        }
    }

    assignEmployeeSalary = async (req, res, next) => {
        try {
            const data = req.body;
            const { employeeID, salary, basicSalary, bonus, reasonForBonus } = data;
            if(!employeeID || !salary || basicSalary === undefined || bonus === undefined || !reasonForBonus) return next(ErrorHandler.badRequest('All Fields Required'));
            if(!isPositiveNumber(salary)) return next(ErrorHandler.badRequest('Salary must be greater than 0'));
            if(!isPositiveNumber(basicSalary)) return next(ErrorHandler.badRequest('Basic salary must be greater than 0'));
            if(Number(basicSalary) > Number(salary)) return next(ErrorHandler.badRequest('Basic salary cannot be greater than total salary'));
            if(Number(bonus) < 0) return next(ErrorHandler.badRequest('Bonus cannot be negative'));
            if(!hasMinLength(reasonForBonus, 3)) return next(ErrorHandler.badRequest('Reason must be at least 3 characters'));
            const obj = {
                "employeeID":data.employeeID
            }
            const isSalaryAssigned = await userService.findSalary(obj);
            if(isSalaryAssigned) return next(ErrorHandler.serverError('Salary already assigned'));

            const d = new Date();
            data["assignedDate"] = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
            const resp = await userService.assignSalary(data);
            if(!resp) return next(ErrorHandler.serverError('Failed to assign salary'));
            res.json({success:true,data:resp}); 
        } catch (error) {
            res.json({success:false,error});
        }
    }

    updateEmployeeSalary = async (req,res,next) => {
        try {
            const body = req.body;
            const {employeeID, salary, basicSalary, bonus, reasonForBonus} = body;
            if(!employeeID || !salary || basicSalary === undefined || bonus === undefined || !reasonForBonus) return next(ErrorHandler.badRequest('All Fields Required'));
            if(!isPositiveNumber(salary)) return next(ErrorHandler.badRequest('Salary must be greater than 0'));
            if(!isPositiveNumber(basicSalary)) return next(ErrorHandler.badRequest('Basic salary must be greater than 0'));
            if(Number(basicSalary) > Number(salary)) return next(ErrorHandler.badRequest('Basic salary cannot be greater than total salary'));
            if(Number(bonus) < 0) return next(ErrorHandler.badRequest('Bonus cannot be negative'));
            if(!hasMinLength(reasonForBonus, 3)) return next(ErrorHandler.badRequest('Reason must be at least 3 characters'));
            const d = new Date();
            body["assignedDate"] = d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate();
            const isSalaryUpdated = await userService.updateSalary({employeeID},body);
            console.log(isSalaryUpdated);
            if(!isSalaryUpdated) return next(ErrorHandler.serverError('Failed to update salary'));
            res.json({success:true,message:'Salary Updated'});
            
        } catch (error) {
            res.json({success:false,error});
        }
    }

    viewSalary = async (req,res,next) => {
        try {
            const data = await getActiveWorkforceFilter(req.body, 'employeeID');
            if(!data) return res.json({success:true,data:[]});
            const resp = await userService.findAllSalary(data);
            if(!resp) return next(ErrorHandler.notFound('No Salary Found'));
            res.json({success:true,data:resp});

        } catch (error) {
            res.json({success:false,error});
        }
    }

    getPayrollSummary = async (req, res, next) => {
        try {
            const { month, year, employeeID } = req.body;
            const selectedMonth = Number(month);
            const selectedYear = Number(year);
            if(!selectedMonth || selectedMonth < 1 || selectedMonth > 12) return next(ErrorHandler.badRequest('Valid month is required'));
            if(!selectedYear || selectedYear < 2000) return next(ErrorHandler.badRequest('Valid year is required'));

            const data = await payrollService.getPayrollSummary({ month: selectedMonth, year: selectedYear, employeeID });
            res.json({ success: true, data });
        } catch (error) {
            console.log('[Payroll][summary failed]', error);
            res.json({ success: false, error });
        }
    }

    generatePayroll = async (req, res, next) => {
        try {
            const { month, year, regenerate } = req.body;
            const selectedMonth = Number(month);
            const selectedYear = Number(year);
            if(!selectedMonth || selectedMonth < 1 || selectedMonth > 12) return next(ErrorHandler.badRequest('Valid month is required'));
            if(!selectedYear || selectedYear < 2000) return next(ErrorHandler.badRequest('Valid year is required'));

            const data = await payrollService.generatePayroll({ month: selectedMonth, year: selectedYear, regenerate: Boolean(regenerate) });
            res.json({
                success: true,
                message: 'Payroll processed',
                data
            });
        } catch (error) {
            console.log('[Payroll][generation failed]', error);
            res.json({ success: false, message: error.message || 'Failed to generate payroll', error });
        }
    }

    markPayrollPaid = async (req, res, next) => {
        try {
            const { employeeID, month, year, paymentDate, paymentMethod, paymentRemarks } = req.body;
            if(!employeeID) return next(ErrorHandler.badRequest('Employee Id Is Required'));
            const selectedMonth = Number(month);
            const selectedYear = Number(year);
            if(!selectedMonth || selectedMonth < 1 || selectedMonth > 12) return next(ErrorHandler.badRequest('Valid month is required'));
            if(!selectedYear || selectedYear < 2000) return next(ErrorHandler.badRequest('Valid year is required'));

            const payroll = await payrollService.markSalaryPaid({
                employeeID,
                month: selectedMonth,
                year: selectedYear,
                paymentDate,
                paymentMethod,
                paymentRemarks
            });
            if(!payroll) return next(ErrorHandler.notFound('Payroll must be generated before marking salary as paid'));
            res.json({ success: true, message: 'Salary marked as paid', data: payroll });
        } catch (error) {
            console.log('[Payroll][mark paid failed]', error);
            res.json({ success: false, error });
        }
    }

    getEmployeePayrollHistory = async (req, res, next) => {
        try {
            const employeeID = req.body.employeeID || (req.user && req.user._id);
            if(!employeeID) return next(ErrorHandler.badRequest('Employee Id Is Required'));
            if(req.user && req.user.type !== 'admin' && String(req.user._id) !== String(employeeID)) {
                return next(ErrorHandler.unAuthorized('You can view only your own payroll'));
            }

            const data = await payrollService.getEmployeePayrollHistory(employeeID);
            res.json({ success: true, data });
        } catch (error) {
            res.json({ success: false, error });
        }
    }

    getEmployeePayrollBreakdown = async (req, res, next) => {
        try {
            const { month, year } = req.body;
            const employeeID = req.body.employeeID || (req.user && req.user._id);
            const selectedMonth = Number(month);
            const selectedYear = Number(year);
            if(!employeeID) return next(ErrorHandler.badRequest('Employee Id Is Required'));
            if(!selectedMonth || selectedMonth < 1 || selectedMonth > 12) return next(ErrorHandler.badRequest('Valid month is required'));
            if(!selectedYear || selectedYear < 2000) return next(ErrorHandler.badRequest('Valid year is required'));
            if(req.user && req.user.type !== 'admin' && String(req.user._id) !== String(employeeID)) {
                return next(ErrorHandler.unAuthorized('You can view only your own payroll'));
            }

            const data = await payrollService.getPayrollSummary({ month: selectedMonth, year: selectedYear, employeeID });
            res.json({ success: true, data: data.rows[0] || null });
        } catch (error) {
            res.json({ success: false, error });
        }
    }
}

module.exports = new UserController();





