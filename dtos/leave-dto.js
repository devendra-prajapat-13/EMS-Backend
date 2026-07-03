class LeaveDto {
    id;
    applicantID;
    name;
    title;
    type;
    startDate;
    endDate;
    appliedDate;
    period;
    reason;
    adminResponse;
    approverID;
    approverRole;
    approverName;
    approverDate;

    constructor(leave) {
        this.id = leave._id;
        this.name = leave?.applicantID?.name;
        this.applicantID = leave.applicantID?._id;
        this.title = leave.title;
        this.type = leave.type;
        this.startDate = leave.startDate;
        this.endDate = leave.endDate;
        this.appliedDate = leave.appliedDate;
        this.period = leave.period;
        this.reason = leave.reason;
        this.adminResponse = leave.adminResponse;
        this.approverID = leave.approverID;
        this.approverRole = leave.approverRole;
        this.approverName = leave.approverName;
        this.approverDate = leave.approverDate;
    }
}

module.exports = LeaveDto;
