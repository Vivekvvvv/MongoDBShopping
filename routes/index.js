const express = require('express');

const router = express.Router();

router.use(require('./behavior'));
router.use(require('./auth'));
router.use(require('./products'));
router.use(require('./addresses'));
router.use(require('./orders'));
router.use(require('./merchants'));
router.use(require('./analytics'));
router.use(require('./admin'));
router.use(require('./reviews'));

module.exports = router;
