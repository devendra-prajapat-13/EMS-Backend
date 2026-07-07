const TeamModel = require('../models/team-model');

class TeamService{

    createTeam = async team => await TeamModel.create(team);

    findTeams = async filter => await TeamModel.find(filter).populate('leader')

    findTeam = async filter => await TeamModel.findOne(filter).populate('leader');

    findCount = async filter => await TeamModel.find(filter).countDocuments();

    updateTeam = async (_id,data) => await TeamModel.updateOne({_id},data,{ runValidators: true });

    updateTeams = async (filter,data) => await TeamModel.updateMany(filter,data,{ runValidators: true });

    deleteTeam = async (_id) => await TeamModel.deleteOne({_id});
    
    

}

module.exports = new TeamService();
