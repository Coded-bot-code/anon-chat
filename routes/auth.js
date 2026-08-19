const express = require('express');
const bcrypt = require('bcrypt');
const { User } = require('../db');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

// Base64 data URLs cap limit
const MAX_PHOTO_DATA_URL_LENGTH = 2_000_000; // ~1.5MB image, base64-encoded

router.post('/signup', async (req, res) => {
  try {
    const { username, password, display_name, profile_photo } = req.body;

    if (!username || !password) {
      return res.render('signup', { error: 'Username and password are required.' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.render('signup', {
        error: 'Username must be 3-20 characters: letters, numbers, underscores only.'
      });
    }
    if (password.length < 6) {
      return res.render('signup', { error: 'Password must be at least 6 characters.' });
    }

    const cleanUsername = username.toLowerCase();

    // Check existing user in MongoDB
    const existing = await User.findOne({ username: cleanUsername });
    if (existing) {
      return res.render('signup', { error: 'That username is already taken.' });
    }

    let photoToStore = '';
    if (profile_photo && profile_photo.startsWith('data:image/') && profile_photo.length <= MAX_PHOTO_DATA_URL_LENGTH) {
      photoToStore = profile_photo;
    }

    const hash = await bcrypt.hash(password, 12);

    // Create user in MongoDB
    const newUser = await User.create({
      username: cleanUsername,
      password_hash: hash,
      display_name: display_name || username,
      profile_photo: photoToStore
    });

    req.session.user = { id: newUser._id, username: newUser.username };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', { error: 'An error occurred during signup. Please try again.' });
  }
});

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').toLowerCase();

    // Find user by username
    const user = await User.findOne({ username: cleanUsername });

    if (!user) {
      return res.render('login', { error: 'Invalid username or password.' });
    }
    const match = await bcrypt.compare(password || '', user.password_hash);
    if (!match) {
      return res.render('login', { error: 'Invalid username or password.' });
    }

    req.session.user = { id: user._id, username: user.username };
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'An error occurred during login. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;