const router = require('express').Router();
const asyncMiddleware = require('../middlewares/async-middleware');
const { authRole } = require('../middlewares/auth-middleware');
const holidayController = require('../controllers/holiday-controller');

router.post('/', authRole(['admin']), asyncMiddleware(holidayController.createHoliday));
router.get('/', authRole(['admin', 'employee', 'leader']), asyncMiddleware(holidayController.getHolidays));
router.get('/:id', authRole(['admin', 'employee', 'leader']), asyncMiddleware(holidayController.getHoliday));
router.put('/:id', authRole(['admin']), asyncMiddleware(holidayController.updateHoliday));
router.delete('/:id', authRole(['admin']), asyncMiddleware(holidayController.deleteHoliday));

module.exports = router;
