const express = require('express');

const { User, Message, BlockedSender } = require('../db');

const { requireAuth } = require('../middleware');



const router = express.Router();



function formatMessages(messages) {

  // sender_hash has `select: false` on the schema, so it's already excluded

  // here — the client never receives it, even indirectly.

  return messages.map((m) => ({

    ...m,

    id: m._id.toString()

  }));

}



router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.redirect('/login');

    console.log('=== DASHBOARD DEBUG ===');
    console.log('Session user ID:', req.session.user.id);
    console.log('User ID from DB:', user._id);
    
    const messages = await Message.find({ recipient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .lean();

    console.log('Messages found:', messages.length);
    if (messages.length > 0) {
      console.log('First message recipient:', messages[0].recipient_id);
    }
    console.log('=======================');

    res.render('dashboard', {
      messages: formatMessages(messages),
      username: user.username,
      displayName: user.display_name,
      profilePhoto: user.profile_photo
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).send('Internal Server Error');
  }
});



router.get('/api/messages', requireAuth, async (req, res) => {

  try {

    const messages = await Message.find({ recipient_id: req.session.user.id })

      .sort({ created_at: -1 })

      .lean();



    res.json({ messages: formatMessages(messages) });

  } catch (err) {

    console.error('API Messages Error:', err);

    res.status(500).json({ error: 'Failed to fetch messages' });

  }

});



router.post('/messages/:id/delete', requireAuth, async (req, res) => {

  try {

    await Message.deleteOne({

      _id: req.params.id,

      recipient_id: req.session.user.id

    });

    res.json({ ok: true });

  } catch (err) {

    console.error('Delete Message Error:', err);

    res.status(500).json({ ok: false, error: 'Failed to delete message' });

  }

});



router.post('/messages/:id/read', requireAuth, async (req, res) => {

  try {

    await Message.updateOne(

      { _id: req.params.id, recipient_id: req.session.user.id },

      { $set: { read: true } }

    );

    res.json({ ok: true });

  } catch (err) {

    console.error('Read Message Error:', err);

    res.status(500).json({ ok: false, error: 'Failed to mark message as read' });

  }

});



router.post('/messages/:id/report', requireAuth, async (req, res) => {

  try {

    const result = await Message.updateOne(

      { _id: req.params.id, recipient_id: req.session.user.id },

      { $set: { flagged: true } }

    );

    if (result.matchedCount === 0) {

      return res.status(404).json({ ok: false, error: 'Message not found' });

    }

    res.json({ ok: true });

  } catch (err) {

    console.error('Report Message Error:', err);

    res.status(500).json({ ok: false, error: 'Failed to report message' });

  }

});



// Blocks the sender of a given message from messaging this user again.

// This works entirely off the anonymous sender_hash stored on the message —

// no IP, location, or device info is ever read, stored in plain form, or

// shown to the user. See utils/senderHash.js for how the hash works.

router.post('/messages/:id/block', requireAuth, async (req, res) => {

  try {

    const message = await Message.findOne({

      _id: req.params.id,

      recipient_id: req.session.user.id

    }).select('+sender_hash');



    if (!message) {

      return res.status(404).json({ ok: false, error: 'Message not found' });

    }

    if (!message.sender_hash) {

      return res.status(400).json({ ok: false, error: 'Sender info unavailable for this message.' });

    }



    await BlockedSender.updateOne(

      { recipient_id: req.session.user.id, sender_hash: message.sender_hash },

      { $setOnInsert: { recipient_id: req.session.user.id, sender_hash: message.sender_hash } },

      { upsert: true }

    );



    res.json({ ok: true });

  } catch (err) {

    console.error('Block Sender Error:', err);

    res.status(500).json({ ok: false, error: 'Failed to block sender' });

  }

});



module.exports = router;