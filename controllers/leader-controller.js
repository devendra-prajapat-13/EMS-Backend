const userService = require('../services/user-service');
const teamService = require('../services/team-service');
const ErrorHandler = require('../utils/error-handler');
const UserDto = require('../dtos/user-dto');
const TeamDto = require('../dtos/team-dto');
const LeaveDto = require('../dtos/leave-dto');

class LeaderController {

    getTeamMembers = async (req, res, next) => {
        const team = await teamService.findTeam({ leader: req.user._id });
        if (!team) return next(ErrorHandler.notFound('You are not leading any team'));
        const members = await userService.findUsers({ team: team._id });
        if (!members || members.length < 1) return next(ErrorHandler.notFound('We could not find any members in your team'));
        const data = members.map((o) => new UserDto(o));
        res.json({ success: true, message: 'Members Found', data });
    }

    getTeam = async (req, res, next) => {
        const team = await teamService.findTeam({ leader: req.user._id });
        if (!team) return next(ErrorHandler.notFound('You are not leading any team'));
        const data = new TeamDto(team);
        res.json({ success: true, message: 'Team Found', data });
    }

    getTeamLeaveApplications = async (req, res, next) => {
        try {
            // Get leader's team
            const team = await teamService.findTeam({ leader: req.user._id });
            if (!team) return next(ErrorHandler.notFound('You are not leading any team'));

            // Get all team members
            const members = await userService.findUsers({ team: team._id });
            if (!members || members.length < 1) return next(ErrorHandler.notFound('No members in your team'));

            // Collect all member IDs
            const memberIds = members.map(m => m._id);

            // Get all leave applications for these members
            const leaves = await userService.findAllLeaveApplications({ applicantID: { $in: memberIds } });
            if (!leaves || leaves.length < 1) return next(ErrorHandler.notFound('No leave applications found'));

            // Convert to DTOs
            const data = leaves.map((l) => new LeaveDto(l));
            res.json({ success: true, message: 'Team Leave Applications Found', data });
        } catch (error) {
            res.json({ success: false, error });
        }
    }

}

module.exports = new LeaderController();
