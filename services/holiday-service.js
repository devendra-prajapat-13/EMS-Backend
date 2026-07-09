const Holiday = require('../models/holiday-model');

class HolidayService {
    createHoliday = (data) => Holiday.create(data);

    findHoliday = (filter) => Holiday.findOne(filter);

    findHolidays = (filter = {}) => Holiday.find(filter).sort({ holidayDate: 1 });

    updateHoliday = (id, data) => Holiday.findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
    });

    deleteHoliday = (id) => Holiday.findByIdAndDelete(id);
}

module.exports = new HolidayService();
