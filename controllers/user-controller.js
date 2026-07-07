const ErrorHandler = require('../utils/error-handler');
const userService = require('../services/user-service');
const UserDto = require('../dtos/user-dto');
const mongoose = require('mongoose');
const LeaveDto = require('../dtos/leave-dto');
const crypto = require('crypto');
const teamService = require('../services/team-service');
const attendanceService = require('../services/attendance-service');

const isValidMobile = (mobile) => /^\d{10}$/.test(String(mobile || ''));
const isPositiveNumber = (value) => Number(value) > 0;
const hasMinLength = (value, length) => String(value || '').trim().length >= length;

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
        return result.deletedCount !== 1 ? next(ErrorHandler.serverError('Failed To Delete User')) : res.json({success:true,message:`${user.name} has been deleted`});
    }

    getUsers = async (req,res,next) =>
    {
        const type = req.path.split('/').pop().replace('s','');
        const emps = await userService.findUsers({type});
        if(!emps || emps.length<1) return next(ErrorHandler.notFound(`No ${type.charAt(0).toUpperCase()+type.slice(1).replace(' ','')} Found`));
        const employees = emps.map((o)=> new UserDto(o));
        res.json({success:true,message:`${type.charAt(0).toUpperCase()+type.slice(1).replace(' ','')} List Found`,data:employees})
    }


    getFreeEmployees = async (req,res,next) =>
    {
        const emps = await userService.findUsers({type:'employee',team:null});
        if(!emps || emps.length<1) return next(ErrorHandler.notFound(`No Free Employee Found`));
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
        const {employeeID} = req.body;
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const d = new Date();

        // const {_id} = employee;
        
        const newAttendance = {
            employeeID,
            year:d.getFullYear(),
            month:d.getMonth() + 1,
            date:d.getDate(),
            day:days[d.getDay()],
            present: true, 
        };

       const isAttendanceMarked = await attendanceService.findAttendance(newAttendance);
       if(isAttendanceMarked) return next(ErrorHandler.notAllowed(d.toLocaleDateString() +" "+ days[d.getDay()-1]+" "+"Attendance Already Marked!"));

       const resp = await attendanceService.markAttendance(newAttendance);
       console.log(resp);
       if(!resp) return next(ErrorHandler.serverError('Failed to mark attendance'));

       const msg = d.toLocaleDateString() +" "+ days[d.getDay()] +" "+ "Attendance Marked!";
       
       res.json({success:true,newAttendance,message:msg});
            
        } catch (error) {
            res.json({success:false,error});    
        } 
    }

    viewEmployeeAttendance = async (req,res,next) => {
        try {
            const data = req.body;
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
            const data = req.body;
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

            // Authorization: allow admin to update any leave; allow leader only for their team members
            if(req.user && req.user.type === 'leader'){
                const leave = await userService.findLeaveApplication({_id: id});
                if(!leave) return next(ErrorHandler.notFound('Leave Application Not Found'));

                const applicant = await userService.findUser({_id: leave.applicantID});
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
            res.json({success:true,message:'Leave Updated'});
            
            
        } catch (error) {
            res.json({success:false,error});
        }
    }

    assignEmployeeSalary = async (req, res, next) => {
        try {
            const data = req.body;
            const { employeeID, salary, bonus, reasonForBonus } = data;
            if(!employeeID || !salary || bonus === undefined || !reasonForBonus) return next(ErrorHandler.badRequest('All Fields Required'));
            if(!isPositiveNumber(salary)) return next(ErrorHandler.badRequest('Salary must be greater than 0'));
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
            const {employeeID, salary, bonus, reasonForBonus} = body;
            if(!employeeID || !salary || bonus === undefined || !reasonForBonus) return next(ErrorHandler.badRequest('All Fields Required'));
            if(!isPositiveNumber(salary)) return next(ErrorHandler.badRequest('Salary must be greater than 0'));
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
            const data = req.body;
            const resp = await userService.findAllSalary(data);
            if(!resp) return next(ErrorHandler.notFound('No Salary Found'));
            res.json({success:true,data:resp});

        } catch (error) {
            res.json({success:false,error});
        }
    }
}

module.exports = new UserController();





