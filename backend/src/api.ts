import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { db } from './db.js';
import { handleRegisterUsernameEvent, handleTransferUsernameEvent, handleReleaseUsernameEvent } from './events.js';

const router = express.Router();

// Middleware for chainhook webhook authentication
function chainhookAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const secret = process.env.CHAINHOOKS_WEBHOOK_SECRET || 'default-secret';

  if (authHeader === secret) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Chainhook webhook endpoints
router.post('/chainhooks/register-username', chainhookAuth, async (req: Request, res: Response) => {
  try {
    await handleRegisterUsernameEvent(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing register-username webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chainhooks/transfer-username', chainhookAuth, async (req: Request, res: Response) => {
  try {
    await handleTransferUsernameEvent(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing transfer-username webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/chainhooks/release-username', chainhookAuth, async (req: Request, res: Response) => {
  try {
    await handleReleaseUsernameEvent(req.body);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error processing release-username webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public API endpoints
router.get('/usernames', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const usernames = await db.getAllUsernames(limit, offset);
    const total = await db.getUsernamesCount();

    res.json({
      results: usernames,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching usernames:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/usernames/:username', async (req: Request, res: Response) => {
  try {
    const username = req.params.username;
    const usernameData = await db.getUsername(username);

    if (!usernameData) {
      return res.status(404).json({ error: 'Username not found' });
    }

    res.json(usernameData);
  } catch (error: any) {
    console.error('Error fetching username:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/usernames/owner/:owner', async (req: Request, res: Response) => {
  try {
    const owner = req.params.owner;
    const usernameData = await db.getUsernameByOwner(owner);

    if (!usernameData) {
      return res.status(404).json({ error: 'No username found for this owner' });
    }

    res.json(usernameData);
  } catch (error: any) {
    console.error('Error fetching username by owner:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/events/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await db.getRecentEvents(limit);
    res.json({ results: events, total: events.length });
  } catch (error: any) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalUsernames = await db.getUsernamesCount();
    res.json({ totalUsernames });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
