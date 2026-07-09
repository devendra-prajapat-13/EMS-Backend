const mongoose = require('mongoose');
const ErrorHandler = require('../utils/error-handler');
const holidayService = require('../services/holiday-service');

const HOLIDAY_TYPES = ['Festival', 'National', 'Company Holiday', 'Optional Holiday'];

const normalizeHolidayDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
};

const buildHolidayPayload = (body, userID) => {
    const holidayName = String(body.holidayName || '').trim();
    const holidayDate = normalizeHolidayDate(body.holidayDate);
    const holidayType = body.holidayType;
    const description = String(body.description || '').trim();
    const isPaid = body.isPaid === true || body.isPaid === 'true' || body.isPaid === 'Yes';

    return {
        holidayName,
        holidayDate,
        holidayType,
        description,
        isPaid,
        createdBy: userID
    };
};

const validateHolidayPayload = (payload) => {
    if (!payload.holidayName) return 'Holiday Name is required';
    if (payload.holidayName.length < 2) return 'Holiday Name must be at least 2 characters';
    if (!payload.holidayDate) return 'Valid Holiday Date is required';
    if (!HOLIDAY_TYPES.includes(payload.holidayType)) return 'Valid Holiday Type is required';
    return '';
};

class HolidayController {
    createHoliday = async (req, res, next) => {
        const payload = buildHolidayPayload(req.body, req.user && req.user._id);
        const validationError = validateHolidayPayload(payload);
        if (validationError) return next(ErrorHandler.badRequest(validationError));

        try {
            const holiday = await holidayService.createHoliday(payload);
            return res.status(201).json({ success: true, message: 'Holiday added', data: holiday });
        }
        catch (error) {
            if (error.code === 11000) return next(ErrorHandler.badRequest('Holiday already exists for this date'));
            throw error;
        }
    };

    getHolidays = async (req, res) => {
        const { year, month, search } = req.query;
        const filter = {};

        if (year && month) {
            const selectedYear = Number(year);
            const selectedMonth = Number(month);
            const start = new Date(selectedYear, selectedMonth - 1, 1);
            const end = new Date(selectedYear, selectedMonth, 1);
            filter.holidayDate = { $gte: start, $lt: end };
        }

        if (search) {
            filter.$or = [
                { holidayName: { $regex: search, $options: 'i' } },
                { holidayType: { $regex: search, $options: 'i' } }
            ];
        }

        const holidays = await holidayService.findHolidays(filter);
        return res.json({ success: true, data: holidays });
    };

    getHoliday = async (req, res, next) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid Holiday Id'));

        const holiday = await holidayService.findHoliday({ _id: id });
        if (!holiday) return next(ErrorHandler.notFound('Holiday not found'));
        return res.json({ success: true, data: holiday });
    };

    updateHoliday = async (req, res, next) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid Holiday Id'));

        const payload = buildHolidayPayload(req.body, req.user && req.user._id);
        const validationError = validateHolidayPayload(payload);
        if (validationError) return next(ErrorHandler.badRequest(validationError));

        try {
            const holiday = await holidayService.updateHoliday(id, payload);
            if (!holiday) return next(ErrorHandler.notFound('Holiday not found'));
            return res.json({ success: true, message: 'Holiday updated', data: holiday });
        }
        catch (error) {
            if (error.code === 11000) return next(ErrorHandler.badRequest('Holiday already exists for this date'));
            throw error;
        }
    };

    deleteHoliday = async (req, res, next) => {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(ErrorHandler.badRequest('Invalid Holiday Id'));

        const holiday = await holidayService.deleteHoliday(id);
        if (!holiday) return next(ErrorHandler.notFound('Holiday not found'));
        return res.json({ success: true, message: 'Holiday deleted' });
    };
}

module.exports = new HolidayController();
