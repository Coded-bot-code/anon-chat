const express = require('express');
const rateLimit = require('express-rate-limit');
const { User, Template, Message, BlockedSender } = require('../db');
const { hashSenderIp } = require('../utils/senderHash');

const router = express.Router();

const CHAT_MODES = {
  '/u': {
    slug: 'anonymous',
    name: 'Anonymous',
    description: 'Receive anonymous messages from anyone.',
    prompt: 'Send me anonymous messages!'
  },
  '/confess': {
    slug: 'confessions',
    name: 'Confessions',
    description: 'Give people a place to anonymously confess something.',
    prompt: 'Tell me something you\'ve always wanted to say.'
  },
  '/about': {
    slug: 'about',
    name: 'One Thing About Me',
    description: 'Find out what people really think about you.',
    prompt: 'One thing you like about me?'
  },
  '/ask': {
    slug: 'ask',
    name: 'Ask Me Anything',
    description: 'Ask me anything without revealing who you are.',
    prompt: 'Ask me anything.'
  },
  '/opinion': {
    slug: 'opinion',
    name: 'Honest Opinion',
    description: 'Get honest opinions from the people around you.',
    prompt: 'What is your honest opinion of me?'
  },
  '/crush': {
    slug: 'crush',
    name: 'Crush',
    description: 'Find out what people secretly think about you.',
    prompt: 'Do you have a crush on me?'
  },
  '/compliment': {
    slug: 'compliment',
    name: 'Compliments',
    description: 'Send me a compliment without revealing yourself.',
    prompt: 'Send me a compliment.'
  },
  '/roast': {
    slug: 'roast',
    name: 'Roast Me',
    description: 'Give me your funniest anonymous roast.',
    prompt: 'Give me your funniest anonymous roast.'
  }
};

function getChatMode(req) {
  return CHAT_MODES[req.baseUrl] || CHAT_MODES['/u'];
}

function renderOptions(req, user, prompt, sent, error, prompts = []) {
  return {
    profileUser: user,
    prompt,
    sent,
    error,
    mode: { ...getChatMode(req), path: req.baseUrl },
    prompts
  };
}

const sendLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'You are sending messages too fast. Please wait a moment and try again.'
});

// GET /u/:username
router.get('/:username', async (req, res) => {
  try {
    const cleanUsername = (req.params.username || '').toLowerCase();
    const user = await User.findOne({ username: cleanUsername }).lean();

    if (!user) return res.status(404).render('404');

    // Map _id to id for template consistency.
    user.id = user._id.toString();

    const mode = getChatMode(req);
    const modeFilter = mode.slug === 'anonymous'
      ? { active: true, $or: [{ mode: 'anonymous' }, { mode: { $exists: false } }] }
      : { active: true, mode: mode.slug };
    const templates = await Template.find(modeFilter).lean();
    const randomPrompt = templates.length
      ? templates[Math.floor(Math.random() * templates.length)].prompt
      : mode.prompt;

    res.render('send-message', renderOptions(req, user, randomPrompt, false, null, templates.map((template) => template.prompt)));
  } catch (err) {
    console.error('Get Public Profile Error:', err);
    res.status(500).render('404');
  }
});

// POST /u/:username
router.post('/:username', sendLimiter, async (req, res) => {
  try {
    const cleanUsername = (req.params.username || '').toLowerCase();
    const user = await User.findOne({ username: cleanUsername }).lean();

    console.log('=== SEND MESSAGE DEBUG ===');
    console.log('Username:', cleanUsername);
    if (!user) return res.status(404).render('404');

    console.log('Found user ID:', user._id);
    console.log('Message body length:', (req.body.body || '').length);

    user.id = user._id.toString();

    const { body, prompt } = req.body;
    const trimmed = (body || '').trim();
    const currentMode = getChatMode(req).slug;
    const modeFilter = currentMode === 'anonymous'
      ? { active: true, $or: [{ mode: 'anonymous' }, { mode: { $exists: false } }] }
      : { active: true, mode: currentMode };
    const modePrompts = await Template.find(modeFilter).select('prompt').lean();
    const prompts = modePrompts.map((template) => template.prompt);

    if (!trimmed) {
      return res.render('send-message', renderOptions(req, user, prompt || getChatMode(req).prompt, false, 'Message cannot be empty.', prompts));
    }

    if (trimmed.length > 1000) {
      return res.render('send-message', renderOptions(req, user, prompt || getChatMode(req).prompt, false, 'Message is too long (max 1000 characters).', prompts));
    }

    // Compute a one-way hash of the sender's IP (never stored/shown in raw
    // form) so the recipient can block this sender if they choose to later.
    const senderHash = hashSenderIp(req.ip);

    const isBlocked = await BlockedSender.exists({
      recipient_id: user._id,
      sender_hash: senderHash
    });

    if (isBlocked) {
      return res.render('send-message', renderOptions(req, user, prompt || getChatMode(req).prompt, false, 'This user is not accepting messages from you right now.', prompts));
    }

    // Store message in MongoDB
    try {
      const newMessage = await Message.create({
        recipient_id: user._id,
        prompt: prompt || '',
        mode: getChatMode(req).slug,
        body: trimmed,
        sender_hash: senderHash
      });
      console.log('Message created with ID:', newMessage._id);
      console.log('Message created with recipient_id:', user._id);
      console.log('===========================');
    } catch (err) {
      console.error('Failed to create message:', err);
      throw err;
    }

    res.render('send-message', renderOptions(req, user, prompt || getChatMode(req).prompt, true, null, prompts));
  } catch (err) {
    console.error('Send Message Error:', err);
    res.status(500).render('404');
  }
});

module.exports = router;
