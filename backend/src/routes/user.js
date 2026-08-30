const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');
const account = require('../controllers/accountController');
const mcpToken = require('../controllers/mcpTokenController');

router.get('/me', requireAuth, userController.getMe);

// Tokens for reaching DiemDesk from an assistant (see /mcp-server).
router.get('/mcp-tokens', requireAuth, mcpToken.list);
router.post('/mcp-tokens', requireAuth, mcpToken.create);
router.delete('/mcp-tokens/:id', requireAuth, mcpToken.revoke);
router.get('/profile', requireAuth, userController.getProfile);
router.put('/profile', requireAuth, userController.updateProfile);

// Account self-service. The export and the delete are GDPR Articles 20 and 17 —
// we serve the UK and EU and had neither. See docs/designs/account-page.md.
router.get('/data-summary', requireAuth, account.dataSummary);
router.get('/export', requireAuth, account.exportData);
router.post('/password', requireAuth, account.changePassword);
router.delete('/account', requireAuth, account.deleteAccount);

module.exports = router;
