const WorkSession = require('../models/work-session-model');

const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDurationMinutes = (session, now = new Date()) => {
    const end = session.logoutTime || now;
    return Math.max(0, Math.round((new Date(end) - new Date(session.loginTime)) / 60000));
};

class WorkSessionService {
    startSession = async (employeeID, loginTime = new Date()) =>
        WorkSession.create({
            employeeID,
            dateKey: formatDateKey(loginTime),
            loginTime
        });

    closeLatestOpenSession = async (employeeID, logoutTime = new Date()) => {
        const session = await WorkSession.findOne({ employeeID, logoutTime: { $exists: false } }).sort({ loginTime: -1 });
        if(!session) return null;

        session.logoutTime = logoutTime;
        session.durationMinutes = getDurationMinutes(session, logoutTime);
        return session.save();
    };

    getSessions = async (filter) => WorkSession.find(filter).sort({ loginTime: 1 });

    getTodaySummary = async (employeeID) => {
        const now = new Date();
        const dateKey = formatDateKey(now);
        const sessions = await this.getSessions({ employeeID, dateKey });
        const totalMinutes = sessions.reduce((total, session) => total + getDurationMinutes(session, now), 0);
        const activeSession = sessions.find((session) => !session.logoutTime);

        return {
            dateKey,
            loginTime: activeSession ? activeSession.loginTime : (sessions[0] && sessions[0].loginTime),
            totalMinutes,
            sessions
        };
    };
}

module.exports = new WorkSessionService();
module.exports.formatDateKey = formatDateKey;
module.exports.getDurationMinutes = getDurationMinutes;
