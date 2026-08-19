const express = require('express');
const { User, Message } = require('../db');
const { requireAuth } = require('../middleware');

const router = express.Router();

function formatMessages(messages) {
  return messages.map((message) => ({
    ...message,
    id: message._id.toString()
  }));
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id).lean();
    if (!user) return res.redirect('/login');

    const messages = await Message.find({ recipient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .lean();

    res.render('inbox', {
      messages: formatMessages(messages),
      username: user.username,
      displayName: user.display_name,
      profilePhoto: user.profile_photo
    });
  } catch (error) {
    console.error('Inbox Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
